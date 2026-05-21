import express from "express";

import {
  uploadMod,
  getModsByGame,
  getModById,
  downloadMod,
  getInstalledMods,
  markAsInstalled,
  uninstallMod,
  deleteMod,
} from "../controllers/modController.js";

import { authMiddleware, requireAdminOrModerator } from "../middlewares/authMiddleware.js";
import { downloadLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.get("/game/:gameId", authMiddleware, getModsByGame);
router.get("/download/:modId", authMiddleware, downloadLimiter, downloadMod);
router.get("/installed", authMiddleware, getInstalledMods);
router.post("/install", authMiddleware, markAsInstalled);
router.delete("/uninstall/:modId", authMiddleware, uninstallMod);

router.post("/upload", authMiddleware, requireAdminOrModerator, uploadMod);
router.delete("/delete/:modId", authMiddleware, requireAdminOrModerator, deleteMod);

// Generic catch-all GET — must stay last to avoid shadowing specific routes above
router.get("/:modId", authMiddleware, getModById);

export default router;
