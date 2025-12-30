// drathos-backend/src/controllers/collectionController.js

import Collection from "../models/collectionModel.js";


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
