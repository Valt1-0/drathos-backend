import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_TOKEN);

    req.user = decoded.user; // Correct
    next();
  } catch (error) {
    logger.error("[authMiddleware] Error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired." });
    }

    res.status(401).json({ message: "Unauthorized." });
  }
};

/**
 * Middleware pour vérifier que l'utilisateur est admin
 */
export const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please authenticate first."
      });
    }

    if (req.user.role !== "admin") {
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

/**
 * Middleware pour vérifier que l'utilisateur est admin ou modérateur
 */
export const requireAdminOrModerator = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Please authenticate first."
      });
    }

    if (req.user.role !== "admin" && req.user.role !== "moderator") {
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
