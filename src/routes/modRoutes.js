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

const router = express.Router();

router.get("/game/:gameId", authMiddleware, getModsByGame);
router.get("/download/:modId", authMiddleware, downloadMod);
router.get("/installed", authMiddleware, getInstalledMods);
router.post("/install", authMiddleware, markAsInstalled);
router.delete("/uninstall/:modId", authMiddleware, uninstallMod);

// Routes admin (avant la route générique /:modId)
router.post("/upload", authMiddleware, requireAdminOrModerator, uploadMod);
router.delete("/delete/:modId", authMiddleware, requireAdminOrModerator, deleteMod);

// Route générique en dernier
router.get("/:modId", authMiddleware, getModById);

export default router;
