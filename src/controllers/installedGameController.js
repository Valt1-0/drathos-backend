// controllers/installedGamesController.js
import InstalledGame from "../models/installedGameModel.js";

export const getInstalledGames = async (req, res) => {
  try {
    const userId = req.user.id;

    const games = await InstalledGame.find({ userId })
      .populate("serverGameId")
      .sort({ installedAt: -1 });

    res.status(200).json(games);
  } catch (err) {
    console.error("Error fetching installed games:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const addInstalledGame = async (req, res) => {
  try {
    const { userId, serverGameId, path, version } = req.body;

    if (!userId || !serverGameId || !path) {
      return res.status(400).json({ message: "Champs requis manquants." });
    }

    // Vérifie si le jeu est déjà installé pour ce user
    const existing = await InstalledGame.findOne({ userId, serverGameId });
    if (existing) {
      return res
        .status(200)
        .json({ message: "Déjà installé", alreadyExists: true });
    }

    const installedGame = new InstalledGame({
      userId,
      serverGameId,
      path,
      version,
    });

    await installedGame.save();

    res
      .status(201)
      .json({ message: "Jeu installé ajouté avec succès", installedGame });
  } catch (err) {
    console.error("Erreur lors de l'ajout d'un jeu installé:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
