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
      return res.status(400).json({ message: "Name is required (max 100 characters)." });
    }
    if (icon !== undefined && !ICON_RE.test(icon)) {
      return res.status(400).json({ message: "Invalid icon." });
    }
    if (color !== undefined && !COLOR_RE.test(color)) {
      return res.status(400).json({ message: "Invalid color (expected #rrggbb format)." });
    }

    const existing = await Collection.findOne({ userId, name: trimmedName });
    if (existing) {
      return res.status(409).json({ message: "A collection with this name already exists" });
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

    res.status(201).json({ message: "Collection created successfully", collection });
  } catch (err) {
    logger.error("Error creating collection:", err);
    res.status(500).json({ message: "Server error" });
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
    logger.error("Error fetching collections:", err);
    res.status(500).json({ message: "Server error" });
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
      return res.status(404).json({ message: "Collection not found" });
    }

    res.status(200).json(collection);
  } catch (err) {
    logger.error("Error fetching collection:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, icon, color } = req.body;

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    if (icon !== undefined && !ICON_RE.test(icon)) {
      return res.status(400).json({ message: "Invalid icon." });
    }
    if (color !== undefined && !COLOR_RE.test(color)) {
      return res.status(400).json({ message: "Invalid color (expected #rrggbb format)." });
    }

    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    if (trimmedName !== undefined && trimmedName.length === 0) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }
    if (trimmedName && trimmedName.length > 100) {
      return res.status(400).json({ message: "Name is too long (max 100 characters)." });
    }

    if (trimmedName && trimmedName !== collection.name) {
      const existing = await Collection.findOne({ userId, name: trimmedName });
      if (existing) {
        return res.status(409).json({ message: "A collection with this name already exists" });
      }
      collection.name = trimmedName;
    }

    if (description !== undefined) collection.description = typeof description === "string" ? description.trim().substring(0, 500) : "";
    if (icon) collection.icon = icon;
    if (color) collection.color = color;

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Collection updated successfully", collection });
  } catch (err) {
    logger.error("Error updating collection:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const collection = await Collection.findOneAndDelete({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    res.status(200).json({ message: "Collection deleted successfully" });
  } catch (err) {
    logger.error("Error deleting collection:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const addGamesToCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "Game list is required" });
    }
    if (gameIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more gameIds are invalid." });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
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

    res.status(200).json({ message: "Games added successfully", collection });
  } catch (err) {
    logger.error("Error adding games:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const removeGamesFromCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "Game list is required" });
    }
    if (gameIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more gameIds are invalid." });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection not found" });
    }

    gameIds.forEach(gameId => {
      collection.removeGame(gameId);
    });

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Games removed successfully", collection });
  } catch (err) {
    logger.error("Error removing games:", err);
    res.status(500).json({ message: "Server error" });
  }
};
