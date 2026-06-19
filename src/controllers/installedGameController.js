import logger from "../utils/logger.js";
import InstalledGame from "../models/installedGameModel.js";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const addInstalledGame = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serverGameId, path, version, installSize } = req.body;

    if (!serverGameId || !path) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    if (!isValidObjectId(serverGameId)) {
      return res.status(400).json({ message: "Invalid serverGameId." });
    }

    const existing = await InstalledGame.findOne({ userId, serverGameId });
    if (existing) {
      return res
        .status(200)
        .json({ message: "Already installed", alreadyExists: true });
    }

    const installedGame = new InstalledGame({
      userId,
      serverGameId,
      path,
      version,
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
      .json({ message: "Installed game added successfully", installedGame });
  } catch (err) {
    logger.error("Error adding installed game:", err);
    res.status(500).json({ message: "Server error" });
  }
};

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
          : "Never played",
        isCurrentlyPlaying: game.stats.currentSession.isPlaying,
        installSizeFormatted: `${game.installSize || 0} MB`,
      },
    }));

    res.status(200).json(formattedGames);
  } catch (err) {
    logger.error("Error fetching installed games:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const launchGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Game not installed" });
    }

    installedGame.stats.currentSession.startTime = Date.now();
    installedGame.stats.currentSession.isPlaying = true;

    // totalSessions is incremented on sync-stats to avoid double-counting between local and remote
    if (!installedGame.stats.firstLaunched) {
      installedGame.stats.firstLaunched = Date.now();
    }

    await installedGame.save();

    res.status(200).json({
      message: "Game launched",
      gamePath: installedGame.path,
      sessionId: installedGame._id,
    });
  } catch (err) {
    logger.error("Error launching game:", err);
    res.status(500).json({ message: "Error during launch" });
  }
};

export const stopGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame || !installedGame.stats.currentSession.isPlaying) {
      return res.status(404).json({ message: "No active session" });
    }

    const sessionStart = installedGame.stats.currentSession.startTime;
    const sessionDuration = Math.floor((Date.now() - sessionStart) / 1000);

    installedGame.stats.totalPlayTime += sessionDuration;
    installedGame.stats.lastPlayed = Date.now();
    installedGame.stats.currentSession.isPlaying = false;
    installedGame.stats.currentSession.startTime = null;

    await installedGame.save();

    res.status(200).json({
      message: "Session ended",
      sessionDuration: formatPlayTime(sessionDuration),
      totalPlayTime: formatPlayTime(installedGame.stats.totalPlayTime),
    });
  } catch (err) {
    logger.error("[Backend] Error stopping game:", err.message);
    res.status(500).json({ message: "Error stopping game" });
  }
};

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
      return res.status(404).json({ message: "Game not installed" });
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
      .json({ message: "Error fetching stats" });
  }
};

export const syncGameStats = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.id;
    const { totalPlayTime, totalSessions, lastPlayed, firstLaunched, sessionDuration } = req.body;

    const toSafeInt = (val, fallback = 0) => {
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
    };

    const installedGame = await InstalledGame.findOne({
      userId,
      serverGameId: gameId,
    });

    if (!installedGame) {
      return res.status(404).json({ message: "Game not installed" });
    }

    const oldTotalPlayTime = installedGame.stats.totalPlayTime || 0;
    const oldTotalSessions = installedGame.stats.totalSessions || 0;
    const oldLastPlayed = installedGame.stats.lastPlayed ? new Date(installedGame.stats.lastPlayed).getTime() : 0;
    const oldFirstLaunched = installedGame.stats.firstLaunched ? new Date(installedGame.stats.firstLaunched).getTime() : Date.now();

    installedGame.stats.totalPlayTime = Math.max(oldTotalPlayTime, toSafeInt(totalPlayTime));
    installedGame.stats.totalSessions = Math.max(oldTotalSessions, toSafeInt(totalSessions));
    installedGame.stats.lastPlayed = Math.max(oldLastPlayed, toSafeInt(lastPlayed));
    installedGame.stats.firstLaunched = Math.min(oldFirstLaunched, toSafeInt(firstLaunched, Date.now()));

    installedGame.stats.currentSession.isPlaying = false;
    installedGame.stats.currentSession.startTime = null;

    await installedGame.save();

    res.status(200).json({
      message: "Stats synchronized successfully",
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
    res.status(500).json({ message: "Error during synchronization" });
  }
};

export const removeInstalledGame = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    if (!gameId || !isValidObjectId(gameId)) {
      return res.status(400).json({ message: "Invalid gameId." });
    }

    const result = await InstalledGame.findOneAndDelete({
      userId,
      serverGameId: gameId,
    });

    if (!result) {
      return res.status(404).json({
        message: "Game not found in installed games",
      });
    }

    res.status(200).json({
      message: "Game uninstalled successfully",
      deletedGame: {
        id: result._id,
        serverGameId: result.serverGameId,
        path: result.path,
      },
    });
  } catch (error) {
    logger.error("[Backend] Error deleting game:", error.message);
    res.status(500).json({
      message: "Server error during uninstall",
      ...(process.env.NODE_ENV !== "production" && { details: error.message }),
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

export const cleanupStuckSessions = async () => {
  try {
    logger.info("[Cleanup] Checking for stuck sessions...");

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
      logger.info(`[Cleanup] ${result.modifiedCount} stuck session(s) reset`);
    } else {
      logger.info("[Cleanup] No stuck sessions");
    }

    return {
      success: true,
      cleanedSessions: result.modifiedCount,
    };
  } catch (error) {
    logger.error("[Cleanup] Error cleaning up sessions:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

function formatRelativeTime(date) {
  const localDate = new Date(date);
  const seconds = Math.floor((Date.now() - localDate.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const isCurrentYear = localDate.getFullYear() === new Date().getFullYear();

  return localDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
}
