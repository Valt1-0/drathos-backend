import express from "express";
import {
  getInstalledGames,
  addInstalledGame,
  launchGame,
  stopGame,
  getGameStats,
  syncGameStats,
  removeInstalledGame,
} from "../controllers/installedGameController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/getInstalledGames", authMiddleware, getInstalledGames);
router.post("/addInstalledGame", authMiddleware, addInstalledGame);
router.delete("/removeInstalledGame/:gameId", authMiddleware, removeInstalledGame);

router.post("/launch/:gameId", authMiddleware, launchGame);
router.post("/stop/:gameId", authMiddleware, stopGame);
router.get("/stats/:gameId", authMiddleware, getGameStats);
router.post("/sync-stats/:gameId", authMiddleware, syncGameStats);

export default router;
