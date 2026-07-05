import logger from "../utils/logger.js";
import { getSettings, updateSettings } from "../utils/serverSettings.js";
import Game from "../models/serverGameModel.js";
import Mod from "../models/modModel.js";

const formatUptime = (uptime) => {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export const getServerHealth = async (req, res) => {
  try {
    res.status(200).json({
      status: "online",
      timestamp: Date.now(),
      ok: true,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      ok: false,
      message: error.message,
    });
  }
};

export const getServerStatus = async (req, res) => {
  try {
    const uptime = process.uptime();
    // Public flag so the registration screen can ask for an invitation code up front
    const settings = await getSettings().catch(() => null);
    const status = {
      status: "online",
      registrationEnabled: settings ? settings.registrationEnabled !== false : true,
      uptime: formatUptime(uptime),
      uptimeSeconds: Math.floor(uptime),
      message: "Server is running ...",
      timestamp: Date.now(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: "MB",
      },
    };
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving server status" });
  }
};

export const getServerSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(200).json({
      error: false,
      settings: {
        maxModSizeGB: settings.maxModSizeGB,
        maxGameSizeGB: settings.maxGameSizeGB,
        registrationEnabled: settings.registrationEnabled !== false,
      },
    });
  } catch (error) {
    logger.error("[getServerSettings] Error:", error.message);
    res.status(500).json({ error: true, message: "Error fetching server settings." });
  }
};

export const patchServerSettings = async (req, res) => {
  try {
    const { maxModSizeGB, maxGameSizeGB, registrationEnabled } = req.body;

    const current = await getSettings();
    const patch = {};

    if (registrationEnabled !== undefined) {
      if (typeof registrationEnabled !== "boolean") {
        return res.status(400).json({ error: true, message: "registrationEnabled must be a boolean." });
      }
      patch.registrationEnabled = registrationEnabled;
    }

    if (maxModSizeGB !== undefined) {
      const v = Number(maxModSizeGB);
      if (!Number.isFinite(v) || v < 0.1 || v > 100) {
        return res.status(400).json({ error: true, message: "maxModSizeGB must be between 0.1 and 100." });
      }
      patch.maxModSizeGB = v;
    }
    if (maxGameSizeGB !== undefined) {
      const v = Number(maxGameSizeGB);
      if (!Number.isFinite(v) || v < 1 || v > 2000) {
        return res.status(400).json({ error: true, message: "maxGameSizeGB must be between 1 and 2000." });
      }
      patch.maxGameSizeGB = v;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: true, message: "No valid fields to update." });
    }

    const warnings = [];

    if (patch.maxGameSizeGB !== undefined && patch.maxGameSizeGB < current.maxGameSizeGB) {
      const limitMB = patch.maxGameSizeGB * 1024;
      const oversizedGames = await Game.find({ sizeMB: { $gt: limitMB } })
        .select("name sizeMB")
        .lean();
      if (oversizedGames.length > 0) {
        warnings.push({
          field: "maxGameSizeGB",
          message: `${oversizedGames.length} existing game(s) exceed the new limit of ${patch.maxGameSizeGB} GB.`,
          affected: oversizedGames.map((g) => ({ name: g.name, sizeMB: g.sizeMB })),
        });
      }
    }

    if (patch.maxModSizeGB !== undefined && patch.maxModSizeGB < current.maxModSizeGB) {
      const limitMB = patch.maxModSizeGB * 1024;
      const oversizedMods = await Mod.find({ sizeMB: { $gt: limitMB } })
        .select("name sizeMB")
        .lean();
      if (oversizedMods.length > 0) {
        warnings.push({
          field: "maxModSizeGB",
          message: `${oversizedMods.length} existing mod(s) exceed the new limit of ${patch.maxModSizeGB} GB.`,
          affected: oversizedMods.map((m) => ({ name: m.name, sizeMB: m.sizeMB })),
        });
      }
    }

    const updated = await updateSettings(patch);
    logger.info(`[patchServerSettings] Updated by ${req.user.username}: ${JSON.stringify(patch)}`);
    if (warnings.length > 0) {
      logger.warn(`[patchServerSettings] ${warnings.length} warning(s) after update by ${req.user.username}`);
    }

    res.status(200).json({
      error: false,
      message: "Server settings updated.",
      settings: {
        maxModSizeGB: updated.maxModSizeGB,
        maxGameSizeGB: updated.maxGameSizeGB,
        registrationEnabled: updated.registrationEnabled !== false,
      },
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    logger.error("[patchServerSettings] Error:", error.message);
    res.status(500).json({ error: true, message: "Error updating server settings." });
  }
};
