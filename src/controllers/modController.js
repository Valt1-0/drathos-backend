import logger from "../utils/logger.js";
import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import Mod from "../models/modModel.js";
import InstalledMod from "../models/installedModModel.js";
import { fileURLToPath } from "url";
import { getSettings } from "../utils/serverSettings.js";

import {
  sanitizePath,
  validateFileName,
  validateFileAccess,
  validateMagicBytes,
  cleanFileName,
} from "../utils/pathValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOD_FILES_DIR =
  process.env.MOD_FILES_DIR ||
  path.join(__dirname, "../../serverData/serverMods/");

if (!fs.existsSync(MOD_FILES_DIR)) {
  fs.mkdirSync(MOD_FILES_DIR, { recursive: true });
}

const TEMP_UPLOAD_DIR = path.join(MOD_FILES_DIR, "temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

const cleanupTempFiles = () => {
  try {
    const now = Date.now();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    for (const file of fs.readdirSync(TEMP_UPLOAD_DIR)) {
      const filePath = path.join(TEMP_UPLOAD_DIR, file);
      try {
        if (now - fs.statSync(filePath).mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          logger.info("[cleanupTempFiles] Removed:", file);
        }
      } catch {}
    }
  } catch (err) {
    logger.warn("[cleanupTempFiles] Error:", err.message);
  }
};

cleanupTempFiles();
setInterval(cleanupTempFiles, 6 * 60 * 60 * 1000).unref();

const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"];

// diskStorage streams directly to disk — avoids loading large files into RAM
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, "").toLowerCase();
    cb(null, `upload-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const fileName = file.originalname.toLowerCase();
  const ext = path.extname(fileName);

  if (fileName.endsWith(".tar.gz") || fileName.endsWith(".tgz")) {
    return cb(null, true);
  }

  if (!allowedExtensions.includes(ext)) {
    return cb(
      new Error("Only .zip, .7z, .rar, .tar, .tar.gz, .tgz files are allowed."),
      false,
    );
  }
  cb(null, true);
};

export const uploadMod = async (req, res) => {
  const settings = await getSettings();
  const fileSizeLimit = settings.maxModSizeGB * 1024 * 1024 * 1024;

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: fileSizeLimit },
  }).single("modFile");

  upload(req, res, async (err) => {
    if (err) {
      logger.error("[uploadMod] Error:", err.message);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: true, message: err.message });
    }

    const {
      gameId,
      name,
      description,
      author,
      version,
      modType,
      compatibleGameVersions,
      platform,
      installPath,
    } = req.body;

    if (!gameId || !name || !req.file) {
      return res
        .status(400)
        .json({ error: true, message: "Missing required fields." });
    }

    try {
      const originalName = path.parse(req.file.originalname).name;
      const extension = path.extname(req.file.originalname).toLowerCase();

      if (!validateMagicBytes(req.file.path, extension)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: true,
          message: "Invalid file content (magic bytes mismatch).",
        });
      }

      const cleanName = cleanFileName(originalName);
      const filename = `${cleanName}${extension}`;

      validateFileName(filename);
      const safePath = sanitizePath(MOD_FILES_DIR, filename);

      if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
      fs.renameSync(req.file.path, safePath);

      let platforms = ["win32", "linux", "darwin"];
      let gameVersions = [];
      try {
        if (platform) platforms = JSON.parse(platform);
      } catch {
        /* keep default */
      }
      try {
        if (compatibleGameVersions)
          gameVersions = JSON.parse(compatibleGameVersions);
      } catch {
        /* keep default */
      }

      const newMod = new Mod({
        gameId,
        name,
        description: description || "",
        author: author || "",
        version: version || "1.0.0",
        zipFileName: filename,
        zipFilePath: safePath,
        installPath: installPath || "Mods",
        sizeMB: req.file.size / (1024 * 1024),
        modType: modType || "other",
        compatibleGameVersions: gameVersions,
        platform: platforms,
        isPublic: true,
        downloads: 0,
      });

      await newMod.save();

      res.status(201).json({
        error: false,
        message: "Mod successfully uploaded.",
        mod: newMod,
      });
    } catch (error) {
      logger.error("[uploadMod] Error:", error);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: true,
        message: "Server error",
        ...(process.env.NODE_ENV !== "production" && { details: error.message }),
      });
    }
  });
};

export const getModsByGame = async (req, res) => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res
        .status(400)
        .json({ error: true, message: "Missing gameId parameter." });
    }

    const mods = await Mod.find({ gameId, isPublic: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ error: false, mods });
  } catch (error) {
    logger.error("[getModsByGame] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Error fetching mods.",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};

export const getModById = async (req, res) => {
  try {
    const mod = await Mod.findById(req.params.modId).lean();

    if (!mod) {
      return res.status(404).json({ error: true, message: "Mod not found." });
    }

    return res.status(200).json(mod);
  } catch (error) {
    logger.error("[getModById] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Error fetching mod.",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};

export const downloadMod = async (req, res) => {
  try {
    const mod = await Mod.findById(req.params.modId);

    if (!mod) {
      return res.status(404).json({ error: true, message: "Mod not found." });
    }

    const safePath = validateFileAccess(mod.zipFilePath, MOD_FILES_DIR);

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: true, message: "File not found." });
    }

    const fileSize = fs.statSync(safePath).size;

    mod.downloads += 1;
    await mod.save();

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${mod.zipFileName}"`,
    );
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");

    const fileStream = fs.createReadStream(safePath, {
      highWaterMark: 2 * 1024 * 1024,
    });

    // Destroy the read stream if the client disconnects mid-download
    res.on("close", () => fileStream.destroy());

    fileStream.on("error", (err) => {
      logger.error("[downloadMod] Stream error:", err);
      fileStream.destroy();
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: "Error streaming file." });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    logger.error("[downloadMod] Error:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: true,
        message: "Error downloading mod.",
        ...(process.env.NODE_ENV !== "production" && { details: error.message }),
      });
    }
  }
};

export const getInstalledMods = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const [installedMods, total] = await Promise.all([
      InstalledMod.find({ userId: req.user.id })
        .populate("modId")
        .populate("gameId")
        .skip(skip)
        .limit(limit)
        .lean(),
      InstalledMod.countDocuments({ userId: req.user.id }),
    ]);

    res.status(200).json({ error: false, installedMods, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error("[getInstalledMods] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error fetching installed mods.",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};

export const markAsInstalled = async (req, res) => {
  try {
    const { modId, gameId } = req.body;

    if (!modId || !gameId) {
      return res.status(400).json({
        error: true,
        message: "Missing modId or gameId.",
      });
    }

    const mod = await Mod.findById(modId).lean();
    if (!mod) {
      return res.status(404).json({ error: true, message: "Mod not found." });
    }

    const existing = await InstalledMod.findOne({
      userId: req.user.id,
      modId,
    }).lean();
    if (existing) {
      return res.status(400).json({
        error: true,
        message: "Mod already installed.",
      });
    }

    const installedMod = new InstalledMod({
      userId: req.user.id,
      modId,
      gameId,
      installedAt: new Date(),
    });

    await installedMod.save();

    res.status(201).json({
      error: false,
      message: "Mod marked as installed.",
      installedMod,
    });
  } catch (error) {
    logger.error("[markAsInstalled] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error marking mod as installed.",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};

export const uninstallMod = async (req, res) => {
  try {
    const result = await InstalledMod.deleteOne({
      userId: req.user.id,
      modId: req.params.modId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: true,
        message: "Installed mod not found.",
      });
    }

    res.status(200).json({ error: false, message: "Mod uninstalled successfully." });
  } catch (error) {
    logger.error("[uninstallMod] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error uninstalling mod.",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};

export const deleteMod = async (req, res) => {
  try {
    const modId = req.params.modId;
    const adminId = req.user.id;

    const mod = await Mod.findById(modId);
    if (!mod) {
      return res.status(404).json({
        error: true,
        message: "Mod not found.",
        code: "MOD_NOT_FOUND",
      });
    }

    const activeInstallations = await InstalledMod.countDocuments({ modId });
    if (activeInstallations > 0) {
      return res.status(409).json({
        error: true,
        message: `Cannot delete mod with ${activeInstallations} active installation(s).`,
        code: "ACTIVE_INSTALLATIONS_EXIST",
        activeInstallations,
      });
    }

    // Validate path before touching the DB — abort early on path traversal attempt
    let safePath = null;
    if (mod.zipFilePath) {
      try {
        safePath = sanitizePath(MOD_FILES_DIR, mod.zipFilePath);
      } catch (pathError) {
        logger.error("[deleteMod] Invalid path:", pathError.message);
        return res.status(403).json({
          error: true,
          message: "Invalid file path.",
          code: "INVALID_FILE_PATH",
        });
      }
    }

    const deletedInstalled = await InstalledMod.deleteMany({ modId });
    await Mod.findByIdAndDelete(modId);

    // Best-effort file deletion — DB is already clean at this point
    let fileDeletedSuccessfully = false;
    let fileErrorDetails = null;

    if (safePath) {
      try {
        if (fs.existsSync(safePath)) {
          fs.unlinkSync(safePath);
          fileDeletedSuccessfully = true;
        } else {
          fileErrorDetails = "FILE_NOT_FOUND";
        }
      } catch (fileError) {
        fileErrorDetails = fileError.message;
        logger.error("[deleteMod] File deletion failed:", fileError.message);
      }
    }

    res.status(200).json({
      error: false,
      message: "Mod deleted successfully.",
      deletedMod: {
        id: mod._id,
        name: mod.name,
        zipFileName: mod.zipFileName,
      },
      cleanup: {
        installationsDeleted: deletedInstalled.deletedCount,
        fileDeleted: fileDeletedSuccessfully,
        fileError: fileErrorDetails,
      },
      audit: {
        deletedBy: adminId,
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error("[deleteMod] Error:", error.message);

    let statusCode = 500;
    let errorCode = "DELETE_FAILED";

    if (
      error.message.includes("interdit") ||
      error.message.includes("introuvable")
    ) {
      statusCode = 403;
      errorCode = "PATH_VALIDATION_ERROR";
    } else if (error.name === "CastError") {
      statusCode = 400;
      errorCode = "INVALID_MOD_ID";
    }

    res.status(statusCode).json({
      error: true,
      message: "Error deleting mod.",
      code: errorCode,
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
    });
  }
};
