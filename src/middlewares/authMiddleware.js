import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";
import { ROLES } from "../utils/constants.js";
import mongoose from "mongoose";

const blacklist = () => mongoose.connection.collection("token_blacklist");

// In-memory cache — populated from DB on startup, kept in sync on revoke.
const tokenBlacklist = new Map();

export const loadBlacklist = async () => {
  try {
    const col = blacklist();
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    await col.createIndex({ token: 1 }, { unique: true, background: true });

    const docs = await col.find({ expiresAt: { $gt: new Date() } }).toArray();
    for (const { token, expiresAt } of docs) {
      tokenBlacklist.set(token, expiresAt.getTime());
    }
    logger.info(`[authMiddleware] Blacklist loaded: ${docs.length} token(s)`);
  } catch (err) {
    logger.error("[authMiddleware] Failed to load blacklist:", err.message);
  }
};

export const revokeToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      const expMs = decoded.exp * 1000;
      tokenBlacklist.set(token, expMs);
      blacklist().insertOne({ token, expiresAt: new Date(expMs) }).catch(() => {});
    }
  } catch {
    // ignore malformed tokens
  }
};

setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist) {
    if (now > expiry) tokenBlacklist.delete(token);
  }
}, 60 * 60 * 1000).unref();

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided." });
    }

    if (tokenBlacklist.has(token)) {
      return res.status(401).json({ message: "Token revoked." });
    }

    const decoded = jwt.verify(token, process.env.JWT_TOKEN);

    req.user = decoded.user;
    next();
  } catch (error) {
    logger.error("[authMiddleware] Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired." });
    }

    res.status(401).json({ message: "Unauthorized." });
  }
};

export const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please authenticate first."
      });
    }

    if (req.user.role !== ROLES.ADMIN) {
      logger.warn(`[requireAdmin] User ${req.user.username} attempted admin action without permission`);
      return res.status(403).json({
        message: "Forbidden. Admin access required."
      });
    }

    logger.info(`[requireAdmin] Admin access granted for ${req.user.username}`);
    next();
  } catch (error) {
    logger.error("[requireAdmin] Error:", error.message);
    res.status(500).json({ message: "Server error during authorization check." });
  }
};

export const requireAdminOrModerator = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please authenticate first."
      });
    }

    if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.MODERATOR) {
      logger.warn(`[requireAdminOrModerator] User ${req.user.username} attempted privileged action without permission`);
      return res.status(403).json({
        message: "Forbidden. Admin or moderator access required."
      });
    }

    logger.info(`[requireAdminOrModerator] Access granted for ${req.user.username} (${req.user.role})`);
    next();
  } catch (error) {
    logger.error("[requireAdminOrModerator] Error:", error.message);
    res.status(500).json({ message: "Server error during authorization check." });
  }
};
