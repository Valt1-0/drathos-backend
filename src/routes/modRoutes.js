import express from "express";

import {
  uploadMod,
  getModsByGame,
  downloadMod,
  getInstalledMods,
  markAsInstalled,
  uninstallMod,
  toggleMod,
} from "../controllers/modController.js";

import { validateObjectId } from "../middlewares/validationMiddleware.js";
import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes publiques (pas d'auth requise)
router.get("/game/:gameId", validateObjectId, getModsByGame);

// Routes nécessitant authentication
router.get("/download/:modId", authMiddleware, validateObjectId, downloadMod);
router.get("/installed", authMiddleware, getInstalledMods);
router.post("/install", authMiddleware, markAsInstalled);
router.delete("/uninstall/:modId", authMiddleware, validateObjectId, uninstallMod);
router.patch("/toggle/:modId", authMiddleware, validateObjectId, toggleMod);

// Routes admin seulement
router.post("/upload", authMiddleware, requireAdmin, uploadMod);

export default router;
