import logger from "../utils/logger.js";
import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import Game from "../models/serverGameModel.js";
import InstalledGame from "../models/installedGameModel.js";
import { fileURLToPath } from "url";
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

import { emitGameAdded } from "../socket.js";

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
    fileSize: 50 * 1024 * 1024 * 1024, // 50 GB max
  },
}).single("zipFile");

export const addGame = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.warn("[addGame] Failed to cleanup temp file:", unlinkError.message);
        }
      }
      return res.status(400).json({ error: true, message: err.message });
    }

    const { version, isPublic, multiplayer, igdbId, executableName } = req.body;

    if (!igdbId) {
      return res.status(400).json({ error: true, message: "Missing IGDB ID." });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ error: true, message: "Missing compressed file." });
    }

    try {
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

      validateFileName(filename);
      const safePath = sanitizePath(GAME_FILES_DIR, filename);

      if (fs.existsSync(safePath)) {
        // Check if a DB record exists for this file — if not, it's an orphan
        const existingGame = await Game.findOne({ zipFileName: filename });
        if (existingGame) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            error: true,
            message: "Un fichier avec ce nom existe déjà",
          });
        }
        // Orphaned file: overwrite it
        logger.warn(`[addGame] Overwriting orphaned file: ${filename}`);
        fs.unlinkSync(safePath);
      }

      fs.renameSync(req.file.path, safePath);

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
              try {
                const parsed =
                  typeof multiplayer === "string"
                    ? JSON.parse(multiplayer)
                    : multiplayer;
                let modes = [];
                if (Array.isArray(parsed.modes)) {
                  modes = parsed.modes;
                } else if (parsed.modes) {
                  try {
                    modes = JSON.parse(parsed.modes);
                  } catch {
                    modes = [];
                  }
                }
                return {
                  enabled: parsed.enabled === "true" || parsed.enabled === true,
                  type: parsed.type || null,
                  maxPlayers: parsed.maxPlayers
                    ? parseInt(parsed.maxPlayers)
                    : null,
                  modes,
                };
              } catch {
                return {
                  enabled: false,
                  type: null,
                  maxPlayers: null,
                  modes: [],
                };
              }
            })()
          : {
              enabled: false,
              type: null,
              maxPlayers: null,
              modes: [],
            },
        executableName: executableName || null,
      });

      await newGame.save();

      // Broadcast notification to all connected clients
      emitGameAdded(
        { id: newGame._id, name: newGame.name, coverUrl: newGame.coverUrl },
        { id: req.user.id, username: req.user.username },
      );

      res.status(201).json({
        error: false,
        message: "Game successfully added.",
        game: newGame,
      });
    } catch (error) {
      logger.error("[addGame] Error:", error.message);

      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          /* ignore */
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
    const { page, limit } = req.query;

    // Pagination optionnelle — sans params, retourne tout (compatibilité frontend)
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      const [games, total] = await Promise.all([
        Game.find().sort({ addedDate: -1 }).skip(skip).limit(limitNum),
        Game.countDocuments(),
      ]);
      return res.status(200).json({ games, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    }

    const games = await Game.find().sort({ addedDate: -1 });
    res.status(200).json(games);
  } catch (error) {
    logger.error("[getAllGames] Error:", error.message);
    res.status(500).json({ error: true, message: "Error fetching games." });
  }
};

export const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found." });
    }
    res.status(200).json(game);
  } catch (error) {
    logger.error("[getGameById] Error:", error.message);
    res.status(500).json({ error: true, message: "Error fetching game." });
  }
};

export const updateGame = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          /* ignore */
        }
      }
      return res.status(400).json({ message: err.message });
    }

    const { title, description, releaseDate, genre } = req.body;

    try {
      const game = await Game.findById(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found." });
      }

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
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch (error) {
          /* ignore */
        }

        fs.renameSync(req.file.path, newPath);

        game.zipFileName = filename;
        game.zipFilePath = newPath;
        game.sizeMB = +(req.file.size / (1024 * 1024)).toFixed(2);
      }
      await game.save();
      res.status(200).json({ message: "Game updated successfully.", game });
    } catch (error) {
      logger.error("[updateGame] Error:", error.message);

      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          /* ignore */
        }
      }

      res.status(500).json({ error: true, message: "Error updating game." });
    }
  });
};

export const deleteGame = async (req, res) => {
  try {
    const gameId = req.params.id;
    const adminId = req.user.id;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        error: true,
        message: "Game not found.",
        code: "GAME_NOT_FOUND",
      });
    }

    const activeInstallations = await InstalledGame.countDocuments({
      serverGameId: gameId,
    });

    if (activeInstallations > 0) {
      return res.status(409).json({
        error: true,
        message: `Cannot delete game with ${activeInstallations} active installation(s). Please uninstall it from all users first.`,
        code: "ACTIVE_INSTALLATIONS_EXIST",
        activeInstallations,
      });
    }

    const deletedInstalled = await InstalledGame.deleteMany({
      serverGameId: gameId,
    });

    await Game.findByIdAndDelete(gameId);

    let fileDeletedSuccessfully = false;
    let fileErrorDetails = null;

    try {
      const safePath = validateFileAccess(game.zipFilePath, GAME_FILES_DIR);
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
        fileDeletedSuccessfully = true;
      } else {
        fileErrorDetails = "FILE_NOT_FOUND";
      }
    } catch (fileError) {
      fileErrorDetails = fileError.message;
    }

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
    logger.error("[deleteGame] Error:", error.message);

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
    if (!game) {
      return res.status(404).json({ message: "Game not found." });
    }

    const safePath = validateFileAccess(game.zipFilePath, GAME_FILES_DIR);

    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ message: "File not found." });
    }

    const stat = fs.statSync(safePath);
    const fileSize = stat.size;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${game.zipFileName}"`,
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");

    const range = req.headers.range;
    let fileStream;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).json({ message: "Range not satisfiable." });
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);

      fileStream = fs.createReadStream(safePath, {
        start,
        end,
        highWaterMark: 2 * 1024 * 1024,
      });
    } else {
      res.setHeader("Content-Length", fileSize);
      fileStream = fs.createReadStream(safePath, {
        highWaterMark: 2 * 1024 * 1024,
      });
    }

    fileStream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ message: "Stream error." });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    logger.error("[downloadGame] Error:", error.message);

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

    const game = await Game.findById(gameId);
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
    logger.error("[configureExecutable] Error:", error);
    res.status(500).json({ error: true, message: "Erreur serveur" });
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

    const files = await listFilesRecursive(gamePath, gamePath);

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
    logger.error("[listGameFiles] Error:", error);
    res.status(500).json({ error: true, message: "Erreur serveur" });
  }
};

async function listFilesRecursive(dir, baseDir) {
  const files = [];

  async function scanDirectory(currentDir) {
    const items = await fs.promises.readdir(currentDir);
    await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(currentDir, item);
        const stats = await fs.promises.stat(fullPath);
        const relativePath = path.relative(baseDir, fullPath);

        if (stats.isDirectory()) {
          await scanDirectory(fullPath);
        } else {
          files.push({
            name: item,
            relativePath,
            fullPath,
            extension: path.extname(item).toLowerCase(),
            size: stats.size,
            isExecutable: path.extname(item).toLowerCase() === ".exe",
          });
        }
      })
    );
  }

  await scanDirectory(dir);
  return files;
}
