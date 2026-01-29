import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import Mod from "../models/modModel.js";
import InstalledMod from "../models/installedModModel.js";
import { fileURLToPath } from "url";

import {
  sanitizePath,
  validateFileName,
  validateFileAccess,
  cleanFileName,
} from "../utils/pathValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOD_FILES_DIR =
  process.env.MOD_FILES_DIR || path.join(__dirname, "../../serverMods/");

if (!fs.existsSync(MOD_FILES_DIR)) {
  fs.mkdirSync(MOD_FILES_DIR, { recursive: true });
}

// Dossier temporaire pour les uploads
const TEMP_UPLOAD_DIR = path.join(MOD_FILES_DIR, "temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz", ".tgz"];

// Utiliser diskStorage pour éviter de charger les gros fichiers en RAM
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Nom temporaire unique pour éviter les collisions
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const fileName = file.originalname.toLowerCase();
  const ext = path.extname(fileName);

  // Check for .tar.gz
  if (fileName.endsWith(".tar.gz") || fileName.endsWith(".tgz")) {
    return cb(null, true);
  }

  // Check other extensions
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Only .zip, .7z, .rar, .tar, .tar.gz, .tgz files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 * 1024, // 20 GB max
  },
}).single("modFile");

// Upload d'un mod (admin only)
export const uploadMod = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("[uploadMod] Error:", err.message);
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
      const cleanName = cleanFileName(originalName);
      const filename = `${cleanName}${extension}`;

      validateFileName(filename);
      const safePath = sanitizePath(MOD_FILES_DIR, filename);

      if (fs.existsSync(safePath)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: true,
          message: "Un fichier avec ce nom existe déjà",
        });
      }

      fs.renameSync(req.file.path, safePath);

      const platforms = platform
        ? JSON.parse(platform)
        : ["win32", "linux", "darwin"];
      const gameVersions = compatibleGameVersions
        ? JSON.parse(compatibleGameVersions)
        : [];

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
      console.error("[uploadMod] Error:", error);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: true,
        message: "Server error",
        details: error.message,
      });
    }
  });
};

// Récupérer les mods pour un jeu spécifique
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

    return res.status(200).json({
      error: false,
      mods,
    });
  } catch (error) {
    console.error("[getModsByGame] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Error fetching mods.",
      details: error.message,
    });
  }
};

// Récupérer un mod par son ID
export const getModById = async (req, res) => {
  try {
    const mod = await Mod.findById(req.params.modId).lean();

    if (!mod) {
      return res.status(404).json({ error: true, message: "Mod not found." });
    }

    return res.status(200).json(mod);
  } catch (error) {
    console.error("[getModById] Error:", error.message);
    return res.status(500).json({
      error: true,
      message: "Error fetching mod.",
      details: error.message,
    });
  }
};

// Télécharger un mod
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

    // Incrémenter le compteur de téléchargements
    mod.downloads += 1;
    await mod.save();

    // Headers pour le téléchargement
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${mod.zipFileName}"`
    );
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");

    const fileStream = fs.createReadStream(safePath, {
      highWaterMark: 2 * 1024 * 1024, // 2 MB chunks
    });

    fileStream.on("error", (err) => {
      console.error("[downloadMod] Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: "Error streaming file." });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("[downloadMod] Error:", error.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: true,
        message: "Error downloading mod.",
        details: error.message,
      });
    }
  }
};

// Récupérer les mods installés par l'utilisateur
export const getInstalledMods = async (req, res) => {
  try {
    const installedMods = await InstalledMod.find({ userId: req.user.id })
      .populate("modId")
      .populate("gameId")
      .lean();

    res.status(200).json({
      error: false,
      installedMods,
    });
  } catch (error) {
    console.error("[getInstalledMods] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error fetching installed mods.",
      details: error.message,
    });
  }
};

// Marquer un mod comme installé
export const markAsInstalled = async (req, res) => {
  try {
    const { modId, gameId } = req.body;

    if (!modId || !gameId) {
      return res.status(400).json({
        error: true,
        message: "Missing modId or gameId.",
      });
    }

    // Vérifier si le mod existe
    const mod = await Mod.findById(modId).lean();
    if (!mod) {
      return res.status(404).json({
        error: true,
        message: "Mod not found.",
      });
    }

    // Vérifier si déjà installé
    const existing = await InstalledMod.findOne({ userId: req.user.id, modId }).lean();
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
    console.error("[markAsInstalled] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error marking mod as installed.",
      details: error.message,
    });
  }
};

// Désinstaller un mod
export const uninstallMod = async (req, res) => {
  try {
    const result = await InstalledMod.deleteOne({
      userId: req.user.id,
      modId: req.params.modId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: true,
        message: "Installed mod not found.",
      });
    }

    res.status(200).json({
      error: false,
      message: "Mod uninstalled successfully.",
    });
  } catch (error) {
    console.error("[uninstallMod] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error uninstalling mod.",
      details: error.message,
    });
  }
};

// Supprimer un mod (admin only)
export const deleteMod = async (req, res) => {
  try {
    const modId = req.params.modId;
    const adminId = req.user.id;

    console.log("[deleteMod] Début suppression - ID:", modId, "Admin:", adminId);

    // Vérifier l'existence du mod
    const mod = await Mod.findById(modId);
    if (!mod) {
      console.error("[deleteMod] Mod non trouvé - ID:", modId);
      return res.status(404).json({
        error: true,
        message: "Mod not found.",
        code: "MOD_NOT_FOUND",
      });
    }

    console.log("[deleteMod] Mod trouvé:", mod.name);

    // Vérifier les installations actives
    const activeInstallations = await InstalledMod.countDocuments({
      modId: modId,
    });

    if (activeInstallations > 0) {
      console.error(`[deleteMod] ${activeInstallations} installation(s) active(s)`);
      return res.status(409).json({
        error: true,
        message: `Cannot delete mod with ${activeInstallations} active installation(s).`,
        code: "ACTIVE_INSTALLATIONS_EXIST",
        activeInstallations,
      });
    }

    console.log("[deleteMod] Aucune installation active");

    // Supprimer les enregistrements InstalledMod
    const deletedInstalled = await InstalledMod.deleteMany({ modId });
    console.log(`[deleteMod] ${deletedInstalled.deletedCount} enregistrements supprimés`);

    // Supprimer le mod de la base de données
    await Mod.findByIdAndDelete(modId);
    console.log("[deleteMod] Mod supprimé de la BD");

    // Supprimer le fichier physique
    let fileDeletedSuccessfully = false;
    let fileErrorDetails = null;

    try {
      const safePath = validateFileAccess(mod.zipFilePath, MOD_FILES_DIR);
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
        fileDeletedSuccessfully = true;
        console.log("[deleteMod] Fichier supprimé:", safePath);
      } else {
        fileErrorDetails = "FILE_NOT_FOUND";
        console.warn("[deleteMod] Fichier introuvable:", safePath);
      }
    } catch (fileError) {
      fileErrorDetails = fileError.message;
      console.error("[deleteMod] Erreur suppression fichier:", fileError.message);
    }

    console.log("[deleteMod] Suppression complétée");

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
    console.error("[deleteMod] Erreur:", error.message);

    let statusCode = 500;
    let errorCode = "DELETE_FAILED";

    if (error.message.includes("interdit") || error.message.includes("introuvable")) {
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
      details: error.message,
    });
  }
};
