import multer from "multer";
import path, { dirname } from "path";
import fs from "fs";
import Game from "../models/serverGameModel.js";
import { fileURLToPath } from "url";
import { log } from "console";
import { fetchGameDetails, fetchGenresByIds } from "./igdbController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GAME_FILES_DIR =
  process.env.GAME_FILES_DIR || path.join(__dirname, "../../serverGames/");

if (!fs.existsSync(GAME_FILES_DIR)) {
  fs.mkdirSync(GAME_FILES_DIR, { recursive: true });
}

const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz"];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error("Only compressed files are allowed."), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter }).single("zipFile");

export const addGame = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: true, message: err.message });
    }

    const { version, isPublic, igdbId } = req.body;

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

      const genreIds = (gameData.genres || []).map((g) => g.id); // 🔥 FIX
      const genres = await fetchGenresByIds(genreIds);

      const originalName = path.parse(req.file.originalname).name;
      const extension = path.extname(req.file.originalname).toLowerCase();
      const cleanName = originalName.trim().toLowerCase().replace(/\s+/g, "_");
      const filename = `${cleanName}${extension}`;
      const filePath = path.join("serverGames", filename);

      if (!fs.existsSync("serverGames")) {
        fs.mkdirSync("serverGames", { recursive: true });
      }

      fs.writeFileSync(filePath, req.file.buffer);

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
        coverUrl:
          gameData.cover?.url.replace(/t_thumb/g, "t_cover_big_2x") || "",
        igdbId: gameData.id,

        zipFileName: filename,
        zipFilePath: filePath,
        version: version || "1.0.0",
        sizeMB: +(req.file.size / (1024 * 1024)).toFixed(2),
        isPublic: isPublic !== undefined ? isPublic : true,
      });

      await newGame.save();

      res.status(201).json({
        error: false,
        message: "Game successfully added.",
        game: newGame,
      });
    } catch (error) {
      console.error("[addGame] Error:", error);
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
    console.error("[getAllGames] Error fetching games:", error.message); // Log error
    res
      .status(500)
      .json({ message: "Error fetching games.", error: error.message });
  }
};

export const getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.error("[getGameById] Game not found for ID:", req.params.id); // Log missing game
      return res.status(404).json({ message: "Game not found." });
    }
    res.status(200).json(game);
  } catch (error) {
    console.error("[getGameById] Error fetching game:", error.message); // Log error
    res
      .status(500)
      .json({ message: "Error fetching game.", error: error.message });
  }
};

export const updateGame = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("[updateGame] Upload error:", err.message);
      return res.status(400).json({ message: err.message });
    }

    const { title, description, releaseDate, genre } = req.body;

    try {
      const game = await Game.findById(req.params.id);
      if (!game) {
        console.error("[updateGame] Game not found for ID:", req.params.id);
        return res.status(404).json({ message: "Game not found." });
      }

      log("[updateGame] Game found:", game.zipFileName); // Log found game

      // Champs textuels
      if (title) game.title = title.trim();
      if (description) game.description = description.trim();
      if (releaseDate) game.releaseDate = new Date(releaseDate);
      if (genre) game.genres = [genre.toLowerCase()];

      // Nouveau fichier ZIP ?
      if (req.file) {
        // Supprimer l'ancien fichier si il existe
        const oldPath = game.zipFilePath;

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log("[updateGame] Ancien fichier supprimé :", oldPath);
        }

        // Générer nom propre
        const originalName = path.parse(req.file.originalname).name;
        const extension = path.extname(req.file.originalname).toLowerCase();
        const cleanName = originalName
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        const filename = `${cleanName}${extension}`;
        const newPath = path.join(GAME_FILES_DIR, filename);

        // Sauvegarder le nouveau fichier
        fs.writeFileSync(newPath, req.file.buffer);

        console.log("[updateGame] Nouveau fichier sauvegardé :", newPath); // Log new file path

        // Mettre à jour les champs
        game.zipFileName = filename;
        game.zipFilePath = newPath;
      }

      await game.save();
      res.status(200).json({ message: "Game updated successfully.", game });
    } catch (error) {
      console.error("[updateGame] Error updating game:", error.message);
      res
        .status(500)
        .json({ message: "Error updating game.", error: error.message });
    }
  });
};

export const deleteGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.error("[deleteGame] Game not found for ID:", req.params.id); // Log missing game
      return res.status(404).json({ message: "Game not found." });
    }

    const zipPath = path.join(__dirname, game.zipFilePath);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath); // Deleting file
      console.log("[deleteGame] Deleted ZIP file:", zipPath); // Log file deletion
    }

    await Game.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Game deleted successfully." });
  } catch (error) {
    console.error("[deleteGame] Error deleting game:", error.message); // Log error
    res
      .status(500)
      .json({ message: "Error deleting game.", error: error.message });
  }
};

export const downloadGame = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    console.log("Requested download for ID:", req.params.id); // 👈 Ici

    if (!game) {
      console.error("[downloadGame] Game not found for ID:", req.params.id);
      return res.status(404).json({ message: "Game not found." });
    }

    // Construct the correct path to the serverGames directory
    const serverGamesDir = path.resolve(__dirname, "../../serverGames");
    const zipPath = path.join(serverGamesDir, game.zipFileName);

    if (!fs.existsSync(zipPath)) {
      console.error("[downloadGame] ZIP file not found:", zipPath);
      return res.status(404).json({ message: "ZIP file not found." });
    }

    res.download(zipPath, game.zipFileName, (err) => {
      if (err) {
        console.error("[downloadGame] Error downloading file:", err.message);
        res.status(500).json({ message: "Error downloading file." });
      }
    });
  } catch (error) {
    console.error("[downloadGame] Error downloading game:", error.message);
    res
      .status(500)
      .json({ message: "Error downloading game.", error: error.message });
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

    // Mettre à jour la configuration executable
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

// Route pour lister les fichiers dans un jeu extrait
export const listGameFiles = async (req, res) => {
  try {
    const { gameId } = req.params;

    // Trouver le jeu installé pour cet utilisateur
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

    // Lister récursivement tous les fichiers
    const files = listFilesRecursive(gamePath, gamePath);

    // Filtrer les executables potentiels
    const executables = files.filter(
      (file) =>
        file.extension === ".exe" ||
        file.extension === ".bat" ||
        file.extension === ".cmd" ||
        file.name.toLowerCase().includes("start") ||
        file.name.toLowerCase().includes("launch") ||
        file.name.toLowerCase().includes("game")
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

// Fonction utilitaire pour lister les fichiers récursivement
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
