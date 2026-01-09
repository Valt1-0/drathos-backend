import express from "express";

import {
  uploadMod,
  getModsByGame,
  getModById,
  downloadMod,
  getInstalledMods,
  markAsInstalled,
  uninstallMod,
  toggleMod,
  deleteMod,
} from "../controllers/modController.js";

import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes publiques
router.get("/game/:gameId", getModsByGame);

// Routes nécessitant authentication (ordre important : routes spécifiques avant les génériques)
router.get("/download/:modId", authMiddleware, downloadMod);
router.get("/installed", authMiddleware, getInstalledMods);
router.post("/install", authMiddleware, markAsInstalled);
router.delete("/uninstall/:modId", authMiddleware, uninstallMod);
router.patch("/toggle/:modId", authMiddleware, toggleMod);

// Routes admin (avant la route générique /:modId)
router.post("/upload", authMiddleware, requireAdmin, uploadMod);
router.delete("/delete/:modId", authMiddleware, requireAdmin, deleteMod);

// Route générique en dernier
router.get("/:modId", authMiddleware, getModById);

export default router;
