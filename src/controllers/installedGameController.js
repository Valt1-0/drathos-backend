// drathos-backend/src/controllers/installedGameController.js

import InstalledGame from "../models/installedGameModel.js";

// Ajouter un jeu installé
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
      // Initialiser les stats de base
      stats: {
        totalPlayTime: 0,
        totalSessions: 0,
        lastPlayed: null,
        firstLaunched: null,
        currentSession: {
          startTime: null,
          isPlaying: false,
        },
        achievements: [],
        customStats: {}, // Utilise un objet pour MongoDB
      },
      installSize: 0, // Sera mis à jour si nécessaire
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

// Récupérer les jeux installés pour un utilisateur
export const getInstalledGames = async (req, res) => {
  try {
    const userId = req.user.id;

    const games = await InstalledGame.find({ userId })
      .populate({
        path: "serverGameId",
        select:
          "name summary coverUrl genres platforms version sizeMB rating aggregatedRating",
      })
      .sort({ "stats.lastPlayed": -1, installedAt: -1 });

    // Formater les données avec stats lisibles
    const formattedGames = games.map((game) => ({
      ...game.toObject(),
      formattedStats: {
        totalPlayTimeFormatted: formatPlayTime(game.stats.totalPlayTime),
        sessionsCount: game.stats.totalSessions,
        lastPlayedFormatted: game.stats.lastPlayed
          ? new Date(game.stats.lastPlayed).toLocaleDateString()
          : "Jamais joué",
        isCurrentlyPlaying: game.stats.currentSession.isPlaying,
        installSizeFormatted: `${game.installSize || 0} MB`,
      },
    }));

    res.status(200).json(formattedGames);
  } catch (err) {
    console.error("Error fetching installed games:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// Lancer un jeu
export const launchGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Jeu non installé" });
    }

    // Marquer le début de session
    installedGame.stats.currentSession.startTime = new Date();
    installedGame.stats.currentSession.isPlaying = true;
    installedGame.stats.totalSessions += 1;

    if (!installedGame.stats.firstLaunched) {
      installedGame.stats.firstLaunched = new Date();
    }

    await installedGame.save();

    res.status(200).json({
      message: "Jeu lancé",
      gamePath: installedGame.path,
      sessionId: installedGame._id,
    });
  } catch (err) {
    console.error("Error launching game:", err);
    res.status(500).json({ message: "Erreur lors du lancement" });
  }
};

// Arrêter un jeu
export const stopGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame || !installedGame.stats.currentSession.isPlaying) {
      return res.status(404).json({ message: "Aucune session active" });
    }

    // Calculer la durée de la session
    const sessionStart = installedGame.stats.currentSession.startTime;
    const sessionDuration = Math.floor(
      (Date.now() - sessionStart.getTime()) / 1000
    );

    // Mettre à jour les statistiques
    installedGame.stats.totalPlayTime += sessionDuration;
    installedGame.stats.lastPlayed = new Date();
    installedGame.stats.currentSession.isPlaying = false;
    installedGame.stats.currentSession.startTime = null;

    await installedGame.save();

    res.status(200).json({
      message: "Session terminée",
      sessionDuration: formatPlayTime(sessionDuration),
      totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
    });
  } catch (err) {
    console.error("Error stopping game:", err);
    res.status(500).json({ message: "Erreur lors de l'arrêt" });
  }
};

// Obtenir les stats d'un jeu installé
export const getGameStats = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    }).populate("serverGameId");

    if (!installedGame) {
      return res.status(404).json({ message: "Jeu non installé" });
    }

    const stats = {
      totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
      totalSessions: installedGame.stats.totalSessions,
      lastPlayed: installedGame.stats.lastPlayed,
      firstLaunched: installedGame.stats.firstLaunched,
      averageSessionTime:
        installedGame.stats.totalSessions > 0
          ? formatPlayTime(
              Math.floor(
                installedGame.stats.totalPlayTime /
                  installedGame.stats.totalSessions
              )
            )
          : "0h 0m",
      isCurrentlyPlaying: installedGame.stats.currentSession.isPlaying,
      achievements: installedGame.stats.achievements || [],
      installSize: `${installedGame.installSize || 0} MB`,
      installedAt: installedGame.installedAt,
      gameName: installedGame.serverGameId.name,
    };

    res.status(200).json(stats);
  } catch (err) {
    console.error("Error fetching game stats:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des stats" });
  }
};

// Fonction utilitaire pour formater le temps de jeu
function formatPlayTime(seconds) {
  if (!seconds || seconds < 60) return "< 1 minute";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

/**
 * 🗑️ Supprime un jeu installé de la base de données
 */
export const removeInstalledGame = async (req, res) => {
  try {
    const userId = req.user.id; // Récupéré depuis le middleware auth
    const { gameId } = req.params;
    if (!gameId) {
      return res.status(400).json({ message: "gameId requis" });
    }

    console.log(
      `[Backend] 🗑️ Suppression jeu: ${gameId} pour user: ${userId}`
    );

    // Trouver et supprimer le jeu installé
    const result = await InstalledGame.findOneAndDelete({
      userId,
      serverGameId: gameId,
    });

    if (!result) {
      return res.status(404).json({
        message: "Jeu non trouvé dans les jeux installés",
      });
    }

    console.log(`[Backend] ✅ Jeu supprimé avec succès: ${result._id}`);

    res.status(200).json({
      message: "Jeu désinstallé avec succès",
      deletedGame: {
        id: result._id,
        serverGameId: result.serverGameId,
        path: result.path,
      },
    });
  } catch (error) {
    console.error("[Backend] ❌ Erreur lors de la suppression du jeu:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la désinstallation",
      error: error.message,
    });
  }
};
