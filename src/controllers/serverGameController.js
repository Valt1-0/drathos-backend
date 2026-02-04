import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import Game from "../models/serverGameModel.js";
import InstalledGame from "../models/installedGameModel.js";
import { fileURLToPath } from "url";
import { log } from "console";
import {
  fetchGameDetails,
  fetchGenresByIds,
  extractCompanies,
} from "./igdbController.js";

import {
  sanitizePath,
  validateFileName,
  validateFileAccess,
  cleanFileName,
} from "../utils/pathValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GAME_FILES_DIR =
  process.env.GAME_FILES_DIR ||
  path.join(__dirname, "../../serverData/serverGames/");

if (!fs.existsSync(GAME_FILES_DIR)) {
  fs.mkdirSync(GAME_FILES_DIR, { recursive: true });
}

const TEMP_UPLOAD_DIR = path.join(GAME_FILES_DIR, "temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Only compressed files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024 * 1024,
  },
}).single("zipFile");

export const addGame = (req, res) => {
  console.log("[addGame] 🚀 Requête reçue");

  upload(req, res, async (err) => {
    console.log("[addGame] 📦 Multer callback appelé");

    if (err) {
      console.error("[addGame] ❌ Erreur Multer:", err.message);

      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(
            "[addGame] 🧹 Fichier temporaire supprimé après erreur Multer",
          );
        } catch (unlinkError) {
          console.error(
            "[addGame] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError,
          );
        }
      }

      return res.status(400).json({ error: true, message: err.message });
    }

    console.log("[addGame] ✅ Fichier uploadé:", req.file?.originalname);

    const { version, isPublic, multiplayer, igdbId, executableName } = req.body;

    if (!igdbId) {
      console.error("[addGame] ❌ IGDB ID manquant");
      return res.status(400).json({ error: true, message: "Missing IGDB ID." });
    }

    if (!req.file) {
      console.error("[addGame] ❌ Fichier manquant");
      return res
        .status(400)
        .json({ error: true, message: "Missing compressed file." });
    }

    try {
      console.log("[addGame] 🔍 Récupération données IGDB pour:", igdbId);
      const gameData = await fetchGameDetails(igdbId);

      const genreIds = (gameData.genres || []).map((g) => g.id);
      const genres = await fetchGenresByIds(genreIds);

      // Extraire les informations de développeur et éditeur
      const { developer, publisher } = extractCompanies(
        gameData.involved_companies,
      );

      const originalName = path.parse(req.file.originalname).name;
      const extension = path.extname(req.file.originalname).toLowerCase();

      const cleanName = cleanFileName(originalName);

      const filename = `${cleanName}${extension}`;
      console.log("[addGame] 📄 Nom final:", filename);

      console.log("[addGame] 🔍 Validation du nom de fichier...");
      validateFileName(filename);
      console.log("[addGame] ✅ Nom de fichier validé");

      console.log("[addGame] 🔍 Sanitization du chemin...");
      const safePath = sanitizePath(GAME_FILES_DIR, filename);
      console.log("[addGame] ✅ Chemin sanitizé:", safePath);

      console.log("[addGame] 🔍 Vérification existence fichier...");
      if (fs.existsSync(safePath)) {
        console.log("[addGame] ❌ Fichier existe déjà:", safePath);
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error: true,
          message: "Un fichier avec ce nom existe déjà",
        });
      }
      console.log("[addGame] ✅ Fichier n'existe pas, OK");

      console.log("[addGame] 📦 Déplacement du fichier...");
      fs.renameSync(req.file.path, safePath);

      console.log(`[addGame] ✅ Fichier sauvegardé: ${safePath}`);

      const newGame = new Game({
        name: gameData.name,
        summary: gameData.summary || "",
        storyline: gameData.storyline || "",
        genres,
        releaseDate: gameData.first_release_date
          ? new Date(gameData.first_release_date * 1000)
          : undefined,
        platforms: gameData.platforms?.map((p) => p.name) || [],
        rating: gameData.rating || 0,
        aggregatedRating: gameData.aggregated_rating || 0,
        coverUrl: gameData.cover?.url
          ? `https:${gameData.cover.url.replace(/t_thumb/g, "t_cover_big_2x")}`
          : "",
        igdbId: gameData.id,
        developer: developer || null,
        publisher: publisher || null,
        zipFileName: filename,
        zipFilePath: safePath,
        version: version || "1.0.0",
        sizeMB: +(req.file.size / (1024 * 1024)).toFixed(2),
        isPublic: isPublic !== undefined ? isPublic : true,
        multiplayer: multiplayer
          ? (() => {
              const parsed =
                typeof multiplayer === "string"
                  ? JSON.parse(multiplayer)
                  : multiplayer;
              return {
                enabled: parsed.enabled === "true" || parsed.enabled === true,
                type: parsed.type || null,
                maxPlayers: parsed.maxPlayers
                  ? parseInt(parsed.maxPlayers)
                  : null,
                modes: Array.isArray(parsed.modes)
                  ? parsed.modes
                  : parsed.modes
                    ? JSON.parse(parsed.modes)
                    : [],
              };
            })()
          : {
              enabled: false,
              type: null,
              maxPlayers: null,
              modes: [],
            },
        executableName: executableName || null,
      });

      console.log("[addGame] 💾 Sauvegarde dans MongoDB...");
      console.log("[addGame] 📊 Données du jeu:", {
        name: newGame.name,
        igdbId: newGame.igdbId,
        version: newGame.version,
      });
      await newGame.save();
      console.log("[addGame] ✅ Jeu sauvegardé dans MongoDB");

      res.status(201).json({
        error: false,
        message: "Game successfully added.",
        game: newGame,
      });
    } catch (error) {
      console.error("[addGame] 💥 Error:", error);

      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log("[addGame] 🧹 Fichier temporaire supprimé après erreur");
        } catch (unlinkError) {
          console.error(
            "[addGame] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError,
          );
        }
      }

      if (
        error.message &&
        (error.message.includes("invalide") ||
          error.message.includes("interdit"))
      ) {
        return res.status(400).json({
          error: true,
          message: error.message,
        });
      }

      res.status(500).json({
        error: true,
        message: "Server error",
        details: error.message,
      });
    }
  });
};

export const getAllGames = async (req, res) => {
  try {
    const games = await Game.find().sort({ addedDate: -1 });
    res.status(200).json(games);
  } catch (error) {
    console.error("[getAllGames] Error fetching games:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching games.", error: error.message });
  }
};

export const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.error("[getGameById] Game not found for ID:", req.params.id);
      return res.status(404).json({ message: "Game not found." });
    }
    res.status(200).json(game);
  } catch (error) {
    console.error("[getGameById] Error fetching game:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching game.", error: error.message });
  }
};

export const updateGame = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("[updateGame] Upload error:", err.message);
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(
            "[updateGame] 🧹 Fichier temporaire supprimé après erreur Multer",
          );
        } catch (unlinkError) {
          console.error(
            "[updateGame] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError,
          );
        }
      }

      return res.status(400).json({ message: err.message });
    }

    const { title, description, releaseDate, genre } = req.body;

    try {
      const game = await Game.findById(req.params.id);
      if (!game) {
        console.error("[updateGame] Game not found for ID:", req.params.id);
        return res.status(404).json({ message: "Game not found." });
      }

      log("[updateGame] Game found:", game.zipFileName);

      if (title) game.title = title.trim();
      if (description) game.description = description.trim();
      if (releaseDate) game.releaseDate = new Date(releaseDate);
      if (genre) game.genres = [genre.toLowerCase()];

      if (req.file) {
        const originalName = path.parse(req.file.originalname).name;
        const extension = path.extname(req.file.originalname).toLowerCase();
        const cleanName = cleanFileName(originalName);
        const filename = `${cleanName}${extension}`;

        validateFileName(filename);

        const newPath = sanitizePath(GAME_FILES_DIR, filename);

        try {
          const oldPath = validateFileAccess(game.zipFilePath, GAME_FILES_DIR);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
            console.log("[updateGame] ✅ Ancien fichier supprimé:", oldPath);
          }
        } catch (error) {
          console.warn(
            "[updateGame] ⚠️ Impossible de supprimer l'ancien fichier:",
            error.message,
          );
        }

        fs.renameSync(req.file.path, newPath);

        console.log("[updateGame] ✅ Nouveau fichier sauvegardé:", newPath);

        game.zipFileName = filename;
        game.zipFilePath = newPath;
        game.sizeMB = +(req.file.size / (1024 * 1024)).toFixed(2);
      }
      await game.save();
      res.status(200).json({ message: "Game updated successfully.", game });
    } catch (error) {
      console.error("[updateGame] Error updating game:", error.message);

      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log(
            "[updateGame] 🧹 Fichier temporaire supprimé après erreur",
          );
        } catch (unlinkError) {
          console.error(
            "[updateGame] ⚠️ Impossible de supprimer le fichier temporaire:",
            unlinkError,
          );
        }
      }

      res
        .status(500)
        .json({ message: "Error updating game.", error: error.message });
    }
  });
};

export const deleteGame = async (req, res) => {
  try {
    const gameId = req.params.id;
    const adminId = req.user.id;

    console.log(
      "[deleteGame] 🚀 Début suppression - ID:",
      gameId,
      "Admin:",
      adminId,
    );

    const game = await Game.findById(gameId);
    if (!game) {
      console.error("[deleteGame] ❌ Jeu non trouvé - ID:", gameId);
      return res.status(404).json({
        error: true,
        message: "Game not found.",
        code: "GAME_NOT_FOUND",
      });
    }

    console.log("[deleteGame] ✅ Jeu trouvé:", game.name);

    const activeInstallations = await InstalledGame.countDocuments({
      serverGameId: gameId,
    });

    if (activeInstallations > 0) {
      console.error(
        `[deleteGame] ⚠️ ${activeInstallations} installation(s) active(s) trouvée(s)`,
      );
      return res.status(409).json({
        error: true,
        message: `Cannot delete game with ${activeInstallations} active installation(s). Please uninstall it from all users first.`,
        code: "ACTIVE_INSTALLATIONS_EXIST",
        activeInstallations,
      });
    }

    console.log("[deleteGame] ✅ Aucune installation active");

    const deletedInstalled = await InstalledGame.deleteMany({
      serverGameId: gameId,
    });
    console.log(
      `[deleteGame] ✅ ${deletedInstalled.deletedCount} enregistrements InstalledGame supprimés`,
    );

    await Game.findByIdAndDelete(gameId);
    console.log("[deleteGame] ✅ Jeu supprimé de la BD");

    let fileDeletedSuccessfully = false;
    let fileErrorDetails = null;

    try {
      const safePath = validateFileAccess(game.zipFilePath, GAME_FILES_DIR);
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
        fileDeletedSuccessfully = true;
        console.log("[deleteGame] ✅ Fichier ZIP supprimé:", safePath);
      } else {
        fileErrorDetails = "FILE_NOT_FOUND";
        console.warn("[deleteGame] ⚠️ Fichier ZIP introuvable:", safePath);
      }
    } catch (fileError) {
      fileErrorDetails = fileError.message;
      console.error(
        "[deleteGame] ⚠️ Erreur suppression fichier:",
        fileError.message,
      );
    }

    console.log("[deleteGame] ✅ Suppression complétée avec succès");

    res.status(200).json({
      error: false,
      message: "Game deleted successfully.",
      deletedGame: {
        id: game._id,
        name: game.name,
        zipFileName: game.zipFileName,
      },
      cleanup: {
        installationsDeleted: deletedInstalled.deletedCount,
        fileDeleted: fileDeletedSuccessfully,
        fileError: fileErrorDetails,
      },
      audit: {
        deletedBy: adminId,
        deletedAt: new Date(),
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("[deleteGame] 💥 Erreur critique:", error.message);

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
      errorCode = "INVALID_GAME_ID";
    }

    res.status(statusCode).json({
      error: true,
      message: "Error deleting game.",
      code: errorCode,
      details: error.message,
    });
  }
};

export const downloadGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    console.log(
      "[downloadGame] Requête de téléchargement - ID:",
      req.params.id,
    );

    if (!game) {
      console.error("[downloadGame] Jeu non trouvé - ID:", req.params.id);
      return res.status(404).json({ message: "Game not found." });
    }

    const safePath = validateFileAccess(game.zipFilePath, GAME_FILES_DIR);
    console.log("[downloadGame] Fichier validé:", safePath);

    if (!fs.existsSync(safePath)) {
      console.error("[downloadGame] Fichier introuvable:", safePath);
      return res.status(404).json({ message: "File not found." });
    }

    const stat = fs.statSync(safePath);
    const fileSize = stat.size;

    console.log(
      `[downloadGame] Taille fichier: ${(fileSize / (1024 * 1024)).toFixed(
        2,
      )} MB`,
    );

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${game.zipFileName}"`,
    );
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");

    const fileStream = fs.createReadStream(safePath, {
      highWaterMark: 2 * 1024 * 1024,
    });

    fileStream.on("open", () => {
      console.log("[downloadGame] Stream ouvert, début envoi...");
    });

    fileStream.on("error", (err) => {
      console.error("[downloadGame] Erreur stream:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Stream error." });
      }
    });

    fileStream.on("end", () => {
      console.log("[downloadGame] Stream terminé avec succès");
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("[downloadGame] Erreur:", error.message);

    if (
      error.message.includes("introuvable") ||
      error.message.includes("interdit")
    ) {
      return res.status(404).json({ message: error.message });
    }

    if (!res.headersSent) {
      res.status(500).json({ message: "Error downloading game." });
    }
  }
};

export const configureExecutable = async (req, res) => {
  try {
    const { gameId } = req.params;
    const {
      fileName,
      relativePath,
      arguments: launchArgs,
      workingDirectory,
      requiresAdmin,
      compatibilityMode,
      prelaunchCommands,
      postlaunchCommands,
      environmentVariables,
    } = req.body;

    const game = await ServerGame.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Jeu non trouvé" });
    }

    game.executable = {
      fileName,
      relativePath,
      arguments: launchArgs || "",
      workingDirectory,
      requiresAdmin: requiresAdmin || false,
      compatibilityMode,
    };

    if (prelaunchCommands || postlaunchCommands || environmentVariables) {
      game.launchConfig = {
        prelaunchCommands: prelaunchCommands || [],
        postlaunchCommands: postlaunchCommands || [],
        environmentVariables: environmentVariables || new Map(),
      };
    }

    await game.save();

    res.status(200).json({
      message: "Configuration executable mise à jour",
      executable: game.executable,
    });
  } catch (error) {
    console.error("[configureExecutable] Error:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

export const listGameFiles = async (req, res) => {
  try {
    const { gameId } = req.params;

    const installedGame = await InstalledGame.findOne({
      userId: req.user.id,
      serverGameId: gameId,
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Jeu non installé" });
    }

    const gamePath = installedGame.path;

    if (!fs.existsSync(gamePath)) {
      return res.status(404).json({ message: "Fichiers du jeu non trouvés" });
    }

    const files = listFilesRecursive(gamePath, gamePath);

    const executables = files.filter(
      (file) =>
        file.extension === ".exe" ||
        file.extension === ".bat" ||
        file.extension === ".cmd" ||
        file.name.toLowerCase().includes("start") ||
        file.name.toLowerCase().includes("launch") ||
        file.name.toLowerCase().includes("game"),
    );

    res.status(200).json({
      allFiles: files,
      suggestedExecutables: executables,
      gamePath: gamePath,
    });
  } catch (error) {
    console.error("[listGameFiles] Error:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

function listFilesRecursive(dir, baseDir) {
  const files = [];

  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stats = fs.statSync(fullPath);
      const relativePath = path.relative(baseDir, fullPath);

      if (stats.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        files.push({
          name: item,
          relativePath: relativePath,
          fullPath: fullPath,
          extension: path.extname(item).toLowerCase(),
          size: stats.size,
          isExecutable: path.extname(item).toLowerCase() === ".exe",
        });
      }
    });
  }

  scanDirectory(dir);
  return files;
}
