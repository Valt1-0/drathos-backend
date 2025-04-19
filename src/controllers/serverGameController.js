import multer from "multer";
import path from "path";
import fs from "fs";
import Game from "../models/serverGameModel.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { log } from "console";

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
      console.error("[addGame] Upload error:", err.message);
      return res.status(400).json({ message: err.message });
    }

    const { title, description, releaseDate, genres, version, isPublic } =
      req.body;

    if (!title || !description || !releaseDate || !genres) {
      console.error("[addGame] Missing required fields");
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!req.file) {
      console.error("[addGame] Missing file");
      return res.status(400).json({ message: "Missing compressed file." });
    }

    try {
      const originalName = path.parse(req.file.originalname).name;
      const extension = path.extname(req.file.originalname).toLowerCase();
      const cleanName = originalName.trim().toLowerCase().replace(/\s+/g, "_");
      const filename = `${cleanName}${extension}`;
      const filePath = path.join("serverGames", filename);

      // Créer le dossier si besoin
      if (!fs.existsSync("serverGames"))
        fs.mkdirSync("serverGames", { recursive: true });

      // Sauvegarder le fichier
      fs.writeFileSync(filePath, req.file.buffer);

      const newGame = new Game({
        title: title.trim(),
        description: description.trim(),
        releaseDate: new Date(releaseDate),
        genres: [genres.trim().toLowerCase()],
        zipFileName: filename,
        zipFilePath: filePath,
        version: version || "1.0.0",
        isPublic: isPublic !== undefined ? isPublic : true,
        addedDate: new Date(),
      });

      await newGame.save();
      res
        .status(201)
        .json({ message: "Game successfully added.", game: newGame });
    } catch (error) {
      console.error("[addGame] Error:", error.message);
      res.status(500).json({ message: "Server error.", error: error.message });
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
