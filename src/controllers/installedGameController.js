// drathos-backend/src/controllers/installedGameController.js

import logger from "../utils/logger.js";
import InstalledGame from "../models/installedGameModel.js";

// Ajouter un jeu installé
export const addInstalledGame = async (req, res) => {
  try {
    const { userId, serverGameId, path, version, installSize } = req.body;

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
        customStats: {},
      },
      installSize: installSize || 0,
    });

    await installedGame.save();

    res
      .status(201)
      .json({ message: "Jeu installé ajouté avec succès", installedGame });
  } catch (err) {
    logger.error("Erreur lors de l'ajout d'un jeu installé:", err);
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
          "name summary storyline coverUrl genres platforms version sizeMB rating aggregatedRating releaseDate developer publisher",
      })
      .sort({ "stats.lastPlayed": -1, installedAt: -1 });

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
    logger.error("Error fetching installed games:", err);
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

    // Marquer la session comme active
    installedGame.stats.currentSession.startTime = Date.now();
    installedGame.stats.currentSession.isPlaying = true;

    // Note : totalSessions sera incrémenté lors de la synchronisation finale (sync-stats)
    // pour éviter le double comptage entre local et remote

    if (!installedGame.stats.firstLaunched) {
      installedGame.stats.firstLaunched = Date.now();
    }

    await installedGame.save();

    res.status(200).json({
      message: "Jeu lancé",
      gamePath: installedGame.path,
      sessionId: installedGame._id,
    });
  } catch (err) {
    logger.error("Error launching game:", err);
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
    const sessionDuration = Math.floor((Date.now() - sessionStart) / 1000);

    // Mettre à jour les statistiques
    installedGame.stats.totalPlayTime += sessionDuration;
    installedGame.stats.lastPlayed = Date.now();
    installedGame.stats.currentSession.isPlaying = false;
    installedGame.stats.currentSession.startTime = null;

    await installedGame.save();

    res.status(200).json({
      message: "Session terminée",
      sessionDuration: formatPlayTime(sessionDuration),
      totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
    });
  } catch (err) {
    logger.error("[Backend] Error stopping game:", err.message);
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
    }).populate({
      path: "serverGameId",
      select:
        "name summary storyline coverUrl genres platforms version sizeMB rating aggregatedRating releaseDate developer publisher",
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Jeu non installé" });
    }

    const stats = {
      totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
      totalSessions: installedGame.stats.totalSessions,
      lastPlayed: installedGame.stats.lastPlayed,
      lastPlayedFormatted: installedGame.stats.lastPlayed
        ? formatRelativeTime(installedGame.stats.lastPlayed)
        : "Never",
      firstLaunched: installedGame.stats.firstLaunched,
      firstLaunchedFormatted: installedGame.stats.firstLaunched
        ? new Date(installedGame.stats.firstLaunched).toLocaleDateString()
        : "Never",
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
    logger.error("Error fetching game stats:", err);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des stats" });
  }
};

/**
 * 🔄 Synchronise les statistiques du client vers le serveur
 * Cette méthode effectue un merge intelligent des stats local/remote
 */
export const syncGameStats = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;
    const { totalPlayTime, totalSessions, lastPlayed, firstLaunched, sessionDuration } = req.body;

    // Trouver le jeu installé
    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Jeu non installé" });
    }

    // MERGE INTELLIGENT : Prendre les valeurs maximales (les plus à jour)
    const oldTotalPlayTime = installedGame.stats.totalPlayTime || 0;
    const oldTotalSessions = installedGame.stats.totalSessions || 0;
    const oldLastPlayed = installedGame.stats.lastPlayed ? new Date(installedGame.stats.lastPlayed).getTime() : 0;
    const oldFirstLaunched = installedGame.stats.firstLaunched ? new Date(installedGame.stats.firstLaunched).getTime() : Date.now();

    // Utiliser les valeurs maximales pour éviter les conflits
    installedGame.stats.totalPlayTime = Math.max(oldTotalPlayTime, totalPlayTime || 0);
    installedGame.stats.totalSessions = Math.max(oldTotalSessions, totalSessions || 0);
    installedGame.stats.lastPlayed = Math.max(oldLastPlayed, lastPlayed || 0);
    installedGame.stats.firstLaunched = Math.min(oldFirstLaunched, firstLaunched || Date.now());

    // Réinitialiser la session actuelle (le jeu est fermé)
    installedGame.stats.currentSession.isPlaying = false;
    installedGame.stats.currentSession.startTime = null;

    await installedGame.save();

    res.status(200).json({
      message: "Stats synchronisées avec succès",
      stats: {
        totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
        totalSessions: installedGame.stats.totalSessions,
        lastPlayed: installedGame.stats.lastPlayed,
        firstLaunched: installedGame.stats.firstLaunched,
        sessionDuration: sessionDuration ? formatPlayTime(sessionDuration) : null,
      },
    });
  } catch (err) {
    logger.error("[Backend] Error syncing stats:", err.message);
    res.status(500).json({ message: "Erreur lors de la synchronisation" });
  }
};

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

    res.status(200).json({
      message: "Jeu désinstallé avec succès",
      deletedGame: {
        id: result._id,
        serverGameId: result.serverGameId,
        path: result.path,
      },
    });
  } catch (error) {
    logger.error("[Backend] Erreur suppression jeu:", error.message);
    res.status(500).json({
      message: "Erreur serveur lors de la désinstallation",
      error: error.message,
    });
  }
};

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
 * 🧹 Nettoie toutes les sessions bloquées au démarrage du serveur
 * (sessions marquées comme "en cours" mais le serveur a redémarré)
 */
export const cleanupStuckSessions = async () => {
  try {
    logger.info("[Cleanup] Vérification des sessions bloquées...");

    const result = await InstalledGame.updateMany(
      { "stats.currentSession.isPlaying": true },
      {
        $set: {
          "stats.currentSession.isPlaying": false,
          "stats.currentSession.startTime": null,
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`[Cleanup] ${result.modifiedCount} session(s) bloquée(s) réinitialisée(s)`);
    } else {
      logger.info("[Cleanup] Aucune session bloquée");
    }

    return {
      success: true,
      cleanedSessions: result.modifiedCount,
    };
  } catch (error) {
    logger.error("[Cleanup] Erreur nettoyage sessions:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

function formatRelativeTime(date) {
  // Convertir la date UTC en timestamp local
  const localDate = new Date(date);
  const seconds = Math.floor((Date.now() - localDate.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  // Pour les dates plus anciennes, afficher avec le fuseau horaire local
  const isCurrentYear = localDate.getFullYear() === new Date().getFullYear();

  // Utiliser toLocaleDateString qui gère automatiquement le fuseau horaire
  return localDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}
