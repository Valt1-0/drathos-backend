import logger from "../utils/logger.js";
import Collection from "../models/collectionModel.js";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const ICON_RE = /^[a-zA-Z0-9_-]{1,50}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const createCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, icon, color } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ message: "Le nom est requis (max 100 caractères)." });
    }
    if (icon !== undefined && !ICON_RE.test(icon)) {
      return res.status(400).json({ message: "Icône invalide." });
    }
    if (color !== undefined && !COLOR_RE.test(color)) {
      return res.status(400).json({ message: "Couleur invalide (format #rrggbb attendu)." });
    }

    const existing = await Collection.findOne({ userId, name: trimmedName });
    if (existing) {
      return res.status(409).json({ message: "Une collection avec ce nom existe déjà" });
    }

    const collection = new Collection({
      userId,
      name: trimmedName,
      description: typeof description === "string" ? description.trim().substring(0, 500) : "",
      icon: icon || "FaFolder",
      color: color || "#6366f1",
      type: "custom",
      games: []
    });

    await collection.save();

    res.status(201).json({ message: "Collection créée avec succès", collection });
  } catch (err) {
    logger.error("Erreur lors de la création de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const getUserCollections = async (req, res) => {
  try {
    const userId = req.user.id;

    const collections = await Collection.find({ userId })
      .populate({
        path: "games.serverGameId",
        select: "name coverUrl genres platforms"
      })
      .sort({ isPinned: -1, createdAt: -1 });

    const collectionsWithCount = collections.map(col => ({
      ...col.toObject(),
      gamesCount: col.games.length
    }));

    res.status(200).json(collectionsWithCount);
  } catch (err) {
    logger.error("Erreur lors de la récupération des collections:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const getCollectionById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const collection = await Collection.findOne({ _id: id, userId })
      .populate({
        path: "games.serverGameId",
        select: "name summary coverUrl genres platforms rating releaseDate developer publisher"
      });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    res.status(200).json(collection);
  } catch (err) {
    logger.error("Erreur lors de la récupération de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const updateCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, icon, color } = req.body;

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    if (icon !== undefined && !ICON_RE.test(icon)) {
      return res.status(400).json({ message: "Icône invalide." });
    }
    if (color !== undefined && !COLOR_RE.test(color)) {
      return res.status(400).json({ message: "Couleur invalide (format #rrggbb attendu)." });
    }

    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    if (trimmedName !== undefined && trimmedName.length === 0) {
      return res.status(400).json({ message: "Le nom ne peut pas être vide." });
    }
    if (trimmedName && trimmedName.length > 100) {
      return res.status(400).json({ message: "Le nom est trop long (max 100 caractères)." });
    }

    if (trimmedName && trimmedName !== collection.name) {
      const existing = await Collection.findOne({ userId, name: trimmedName });
      if (existing) {
        return res.status(409).json({ message: "Une collection avec ce nom existe déjà" });
      }
      collection.name = trimmedName;
    }

    if (description !== undefined) collection.description = typeof description === "string" ? description.trim().substring(0, 500) : "";
    if (icon) collection.icon = icon;
    if (color) collection.color = color;

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Collection mise à jour avec succès", collection });
  } catch (err) {
    logger.error("Erreur lors de la mise à jour de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const deleteCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const collection = await Collection.findOneAndDelete({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    res.status(200).json({ message: "Collection supprimée avec succès" });
  } catch (err) {
    logger.error("Erreur lors de la suppression de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const addGamesToCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "La liste des jeux est requise" });
    }
    if (gameIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "Un ou plusieurs gameIds sont invalides." });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    gameIds.forEach(gameId => {
      collection.addGame(gameId);
    });

    collection.updatedAt = Date.now();
    await collection.save();

    await collection.populate({
      path: "games.serverGameId",
      select: "name coverUrl genres platforms"
    });

    res.status(200).json({ message: "Jeux ajoutés avec succès", collection });
  } catch (err) {
    logger.error("Erreur lors de l'ajout des jeux:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const removeGamesFromCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "La liste des jeux est requise" });
    }
    if (gameIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "Un ou plusieurs gameIds sont invalides." });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    gameIds.forEach(gameId => {
      collection.removeGame(gameId);
    });

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Jeux retirés avec succès", collection });
  } catch (err) {
    logger.error("Erreur lors du retrait des jeux:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
