// drathos-backend/src/controllers/collectionController.js

import Collection from "../models/collectionModel.js";
import InstalledGame from "../models/installedGameModel.js";
import ServerGame from "../models/serverGameModel.js";

// ==================== CRUD COLLECTIONS ====================

// Créer une nouvelle collection
export const createCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, icon, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Le nom de la collection est requis" });
    }

    // Vérifier si une collection avec ce nom existe déjà pour cet utilisateur
    const existing = await Collection.findOne({ userId, name });
    if (existing) {
      return res.status(409).json({ message: "Une collection avec ce nom existe déjà" });
    }

    const collection = new Collection({
      userId,
      name,
      description,
      icon: icon || "FaFolder",
      color: color || "#6366f1",
      type: "custom",
      games: []
    });

    await collection.save();

    res.status(201).json({ message: "Collection créée avec succès", collection });
  } catch (err) {
    console.error("Erreur lors de la création de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Récupérer toutes les collections d'un utilisateur
export const getUserCollections = async (req, res) => {
  try {
    const userId = req.user.id;

    const collections = await Collection.find({ userId })
      .populate({
        path: "games.serverGameId",
        select: "name coverUrl genres platforms"
      })
      .sort({ isPinned: -1, createdAt: -1 });

    // Ajouter le count des jeux
    const collectionsWithCount = collections.map(col => ({
      ...col.toObject(),
      gamesCount: col.games.length
    }));

    res.status(200).json(collectionsWithCount);
  } catch (err) {
    console.error("Erreur lors de la récupération des collections:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Récupérer une collection spécifique
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
    console.error("Erreur lors de la récupération de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Mettre à jour une collection
export const updateCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, icon, color } = req.body;

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    // Vérifier si le nouveau nom existe déjà (si changé)
    if (name && name !== collection.name) {
      const existing = await Collection.findOne({ userId, name });
      if (existing) {
        return res.status(409).json({ message: "Une collection avec ce nom existe déjà" });
      }
      collection.name = name;
    }

    if (description !== undefined) collection.description = description;
    if (icon) collection.icon = icon;
    if (color) collection.color = color;

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Collection mise à jour avec succès", collection });
  } catch (err) {
    console.error("Erreur lors de la mise à jour de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Supprimer une collection
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
    console.error("Erreur lors de la suppression de la collection:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==================== GESTION DES JEUX ====================

// Ajouter des jeux à une collection
export const addGamesToCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "La liste des jeux est requise" });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    // Ajouter chaque jeu (la méthode addGame gère les doublons)
    gameIds.forEach(gameId => {
      collection.addGame(gameId);
    });

    collection.updatedAt = Date.now();
    await collection.save();

    // Repopulate pour retourner les jeux complets
    await collection.populate({
      path: "games.serverGameId",
      select: "name coverUrl genres platforms"
    });

    res.status(200).json({ message: "Jeux ajoutés avec succès", collection });
  } catch (err) {
    console.error("Erreur lors de l'ajout des jeux:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Retirer des jeux d'une collection
export const removeGamesFromCollection = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameIds } = req.body;

    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ message: "La liste des jeux est requise" });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    // Retirer chaque jeu
    gameIds.forEach(gameId => {
      collection.removeGame(gameId);
    });

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Jeux retirés avec succès", collection });
  } catch (err) {
    console.error("Erreur lors du retrait des jeux:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Réorganiser les jeux dans une collection (drag & drop)
export const reorderGames = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { gameOrders } = req.body;

    if (!gameOrders || !Array.isArray(gameOrders)) {
      return res.status(400).json({ message: "Les nouveaux ordres sont requis" });
    }

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    // Réorganiser avec la méthode du modèle
    collection.reorderGames(gameOrders);

    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({ message: "Jeux réorganisés avec succès", collection });
  } catch (err) {
    console.error("Erreur lors de la réorganisation des jeux:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==================== ACTIONS ====================

// Épingler/Désépingler une collection
export const togglePin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const collection = await Collection.findOne({ _id: id, userId });

    if (!collection) {
      return res.status(404).json({ message: "Collection non trouvée" });
    }

    collection.isPinned = !collection.isPinned;
    collection.updatedAt = Date.now();
    await collection.save();

    res.status(200).json({
      message: `Collection ${collection.isPinned ? 'épinglée' : 'désépinglée'} avec succès`,
      collection
    });
  } catch (err) {
    console.error("Erreur lors du toggle pin:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==================== SMART COLLECTIONS ====================

// Jeux installés
export const getInstalledGames = async (req, res) => {
  try {
    const userId = req.user.id;

    const installedGames = await InstalledGame.find({ userId })
      .populate({
        path: "serverGameId",
        select: "name summary coverUrl genres platforms rating releaseDate developer publisher"
      })
      .sort({ installedAt: -1 });

    const games = installedGames.map(ig => ig.serverGameId).filter(g => g !== null);

    res.status(200).json({
      type: "smart",
      name: "Installed",
      icon: "FaDownload",
      color: "#10b981",
      games,
      gamesCount: games.length
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des jeux installés:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Jeux non installés
export const getNotInstalledGames = async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer tous les jeux publics
    const allGames = await ServerGame.find({ isPublic: true })
      .select("name summary coverUrl genres platforms rating releaseDate developer publisher");

    // Récupérer les IDs des jeux installés
    const installedGames = await InstalledGame.find({ userId }).select("serverGameId");
    const installedIds = installedGames.map(ig => ig.serverGameId.toString());

    // Filtrer les jeux non installés
    const notInstalledGames = allGames.filter(
      game => !installedIds.includes(game._id.toString())
    );

    res.status(200).json({
      type: "smart",
      name: "Not Installed",
      icon: "FaCloudDownloadAlt",
      color: "#6b7280",
      games: notInstalledGames,
      gamesCount: notInstalledGames.length
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des jeux non installés:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Jeux récemment joués (7 derniers jours)
export const getRecentlyPlayed = async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const recentGames = await InstalledGame.find({
      userId,
      'stats.lastPlayed': { $gte: sevenDaysAgo }
    })
    .populate({
      path: "serverGameId",
      select: "name summary coverUrl genres platforms rating releaseDate developer publisher"
    })
    .sort({ 'stats.lastPlayed': -1 })
    .limit(50);

    const games = recentGames.map(rg => rg.serverGameId).filter(g => g !== null);

    res.status(200).json({
      type: "smart",
      name: "Recently Played",
      icon: "FaClock",
      color: "#f59e0b",
      games,
      gamesCount: games.length
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des jeux récemment joués:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Jeux les plus joués (top 10)
export const getMostPlayed = async (req, res) => {
  try {
    const userId = req.user.id;

    const mostPlayedGames = await InstalledGame.find({
      userId,
      'stats.totalPlayTime': { $gt: 0 }
    })
    .populate({
      path: "serverGameId",
      select: "name summary coverUrl genres platforms rating releaseDate developer publisher"
    })
    .sort({ 'stats.totalPlayTime': -1 })
    .limit(10);

    const games = mostPlayedGames.map(mpg => mpg.serverGameId).filter(g => g !== null);

    res.status(200).json({
      type: "smart",
      name: "Most Played",
      icon: "FaTrophy",
      color: "#eab308",
      games,
      gamesCount: games.length
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des jeux les plus joués:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
