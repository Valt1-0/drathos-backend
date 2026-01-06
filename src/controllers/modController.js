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
  process.env.MOD_FILES_DIR || path.join(__dirname, "../../mods/");

if (!fs.existsSync(MOD_FILES_DIR)) {
  fs.mkdirSync(MOD_FILES_DIR, { recursive: true });
}

// Dossier temporaire pour les uploads
const TEMP_UPLOAD_DIR = path.join(MOD_FILES_DIR, "temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

const allowedExtensions = [".zip", ".7z", ".rar"];

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
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Only .zip, .7z, and .rar files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5 GB max
  },
}).single("modFile");

// Upload d'un mod (admin only)
export const uploadMod = (req, res) => {
  console.log("[uploadMod] 🚀 Requête reçue");

  upload(req, res, async (err) => {
    console.log("[uploadMod] 📦 Multer callback appelé");

    if (err) {
      console.error("[uploadMod] ❌ Erreur Multer:", err.message);

      // Nettoyer le fichier temporaire si l'upload a échoué
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(
            "[uploadMod] 🧹 Fichier temporaire supprimé après erreur Multer"
          );
        } catch (unlinkError) {
          console.error(
            "[uploadMod] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError
          );
        }
      }

      return res.status(400).json({ error: true, message: err.message });
    }

    console.log("[uploadMod] ✅ Fichier uploadé:", req.file?.originalname);

    const {
      gameId,
      name,
      description,
      author,
      version,
      modType,
      compatibleGameVersions,
      platform,
    } = req.body;

    if (!gameId || !name) {
      console.error("[uploadMod] ❌ gameId ou name manquant");
      return res
        .status(400)
        .json({ error: true, message: "Missing gameId or name." });
    }

    if (!req.file) {
      console.error("[uploadMod] ❌ Fichier manquant");
      return res
        .status(400)
        .json({ error: true, message: "Missing mod file." });
    }

    try {
      const originalName = path.parse(req.file.originalname).name;
      const extension = path.extname(req.file.originalname).toLowerCase();

      console.log("[uploadMod] 📝 Nom original:", originalName);

      const cleanName = cleanFileName(originalName);
      console.log("[uploadMod] 🧹 Nom nettoyé:", cleanName);

      const filename = `${cleanName}${extension}`;
      console.log("[uploadMod] 📄 Nom final:", filename);

      console.log("[uploadMod] 🔍 Validation du nom de fichier...");
      validateFileName(filename);
      console.log("[uploadMod] ✅ Nom de fichier validé");

      console.log("[uploadMod] 🔍 Sanitization du chemin...");
      const safePath = sanitizePath(MOD_FILES_DIR, filename);
      console.log("[uploadMod] ✅ Chemin sanitizé:", safePath);

      console.log("[uploadMod] 🔍 Vérification existence fichier...");
      if (fs.existsSync(safePath)) {
        console.log("[uploadMod] ❌ Fichier existe déjà:", safePath);
        // Supprimer le fichier temporaire
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: true,
          message: "Un fichier avec ce nom existe déjà",
        });
      }
      console.log("[uploadMod] ✅ Fichier n'existe pas, OK");

      console.log("[uploadMod] 📦 Déplacement du fichier temporaire...");
      fs.renameSync(req.file.path, safePath);
      console.log("[uploadMod] ✅ Fichier déplacé vers:", safePath);

      const fileSizeInMB = req.file.size / (1024 * 1024);
      console.log(
        "[uploadMod] 📊 Taille du fichier:",
        fileSizeInMB.toFixed(2),
        "MB"
      );

      // Parser les platforms et compatibleGameVersions
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
        sizeMB: fileSizeInMB,
        modType: modType || "other",
        compatibleGameVersions: gameVersions,
        platform: platforms,
        isPublic: true,
        downloads: 0,
      });

      console.log("[uploadMod] 💾 Sauvegarde dans MongoDB...");
      await newMod.save();
      console.log("[uploadMod] ✅ Mod sauvegardé dans MongoDB");

      res.status(201).json({
        error: false,
        message: "Mod successfully uploaded.",
        mod: newMod,
      });
    } catch (error) {
      console.error("[uploadMod] 💥 Error:", error);

      // Nettoyer le fichier temporaire en cas d'erreur
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log("[uploadMod] 🧹 Fichier temporaire supprimé après erreur");
        } catch (unlinkError) {
          console.error(
            "[uploadMod] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError
          );
        }
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

    const mods = await Mod.find({ gameId, isPublic: true }).sort({
      createdAt: -1,
    });

    console.log(`[getModsByGame] Trouvé ${mods.length} mods pour gameId:`, gameId);

    res.status(200).json({
      error: false,
      mods,
    });
  } catch (error) {
    console.error("[getModsByGame] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error fetching mods.",
      details: error.message,
    });
  }
};

// Télécharger un mod
export const downloadMod = async (req, res) => {
  try {
    const mod = await Mod.findById(req.params.modId);
    console.log(
      "[downloadMod] Requête de téléchargement - ID:",
      req.params.modId
    );

    if (!mod) {
      console.error("[downloadMod] Mod non trouvé - ID:", req.params.modId);
      return res.status(404).json({ error: true, message: "Mod not found." });
    }

    const safePath = validateFileAccess(mod.zipFilePath, MOD_FILES_DIR);
    console.log("[downloadMod] Fichier validé:", safePath);

    if (!fs.existsSync(safePath)) {
      console.error("[downloadMod] Fichier introuvable:", safePath);
      return res.status(404).json({ error: true, message: "File not found." });
    }

    const stat = fs.statSync(safePath);
    const fileSize = stat.size;

    console.log(
      `[downloadMod] Taille fichier: ${(fileSize / (1024 * 1024)).toFixed(
        2
      )} MB`
    );

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

    fileStream.on("open", () => {
      console.log("[downloadMod] Stream ouvert, début envoi...");
    });

    fileStream.on("error", (err) => {
      console.error("[downloadMod] Erreur stream:", err);
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
    const userId = req.user.id;

    const installedMods = await InstalledMod.find({ userId })
      .populate("modId")
      .populate("gameId");

    console.log(
      `[getInstalledMods] Trouvé ${installedMods.length} mods installés pour userId:`,
      userId
    );

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
    const userId = req.user.id;
    const { modId, gameId } = req.body;

    if (!modId || !gameId) {
      return res.status(400).json({
        error: true,
        message: "Missing modId or gameId.",
      });
    }

    // Vérifier si le mod existe
    const mod = await Mod.findById(modId);
    if (!mod) {
      return res.status(404).json({
        error: true,
        message: "Mod not found.",
      });
    }

    // Vérifier si déjà installé
    const existing = await InstalledMod.findOne({ userId, modId });
    if (existing) {
      return res.status(400).json({
        error: true,
        message: "Mod already installed.",
      });
    }

    const installedMod = new InstalledMod({
      userId,
      modId,
      gameId,
      enabled: true,
      installedAt: new Date(),
    });

    await installedMod.save();

    console.log(
      `[markAsInstalled] Mod ${modId} marqué comme installé pour user ${userId}`
    );

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
    const userId = req.user.id;
    const { modId } = req.params;

    if (!modId) {
      return res.status(400).json({
        error: true,
        message: "Missing modId parameter.",
      });
    }

    const result = await InstalledMod.deleteOne({ userId, modId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: true,
        message: "Installed mod not found.",
      });
    }

    console.log(`[uninstallMod] Mod ${modId} désinstallé pour user ${userId}`);

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

// Toggle activation d'un mod
export const toggleMod = async (req, res) => {
  try {
    const userId = req.user.id;
    const { modId } = req.params;
    const { enabled } = req.body;

    if (!modId || typeof enabled !== "boolean") {
      return res.status(400).json({
        error: true,
        message: "Missing or invalid parameters.",
      });
    }

    const installedMod = await InstalledMod.findOne({ userId, modId });

    if (!installedMod) {
      return res.status(404).json({
        error: true,
        message: "Installed mod not found.",
      });
    }

    installedMod.enabled = enabled;
    installedMod.lastUsed = new Date();
    await installedMod.save();

    console.log(
      `[toggleMod] Mod ${modId} ${enabled ? "activé" : "désactivé"} pour user ${userId}`
    );

    res.status(200).json({
      error: false,
      message: `Mod ${enabled ? "enabled" : "disabled"} successfully.`,
      installedMod,
    });
  } catch (error) {
    console.error("[toggleMod] Error:", error.message);
    res.status(500).json({
      error: true,
      message: "Error toggling mod.",
      details: error.message,
    });
  }
};
