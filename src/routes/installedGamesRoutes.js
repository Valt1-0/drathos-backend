// drathos-backend/src/routes/installedGamesRoutes.js

import express from "express";
import {
  getInstalledGames,
  addInstalledGame,
  launchGame,
  stopGame,
  getGameStats,
  removeInstalledGame,
} from "../controllers/installedGameController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes existantes
router.get("/getInstalledGames", authMiddleware, getInstalledGames);
router.post("/addInstalledGame", authMiddleware, addInstalledGame);
router.delete("/removeInstalledGame/:gameId", authMiddleware, removeInstalledGame);

// Nouvelles routes pour le tracking
router.post("/launch/:gameId", authMiddleware, launchGame);
router.post("/stop/:gameId", authMiddleware, stopGame);
router.get("/stats/:gameId", authMiddleware, getGameStats);

export default router;
