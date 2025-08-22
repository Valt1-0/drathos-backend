// routes/installedGamesRoute.js
import express from "express";
import {
  getInstalledGames,
  addInstalledGame,
} from "../controllers/installedGameController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/getInstalledGames", authMiddleware, getInstalledGames);
router.post("/addInstalledGame", authMiddleware, addInstalledGame);

export default router;
