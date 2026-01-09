import express from "express";

import {
  addGame,
  getAllGames,
  getGameById,
  updateGame,
  deleteGame,
  downloadGame,
} from "../controllers/serverGameController.js";

import {
  validateAddGame,
  validateUpdateGame,
  validateObjectId,
} from "../middlewares/validationMiddleware.js";

import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes nécessitant authentification
router.get("/getAllGames", authMiddleware, getAllGames);
router.get("/getGameById/:id", authMiddleware, validateObjectId, getGameById);
router.get("/downloadGame/:id", authMiddleware, validateObjectId, downloadGame);

// Routes admin seulement
router.post("/addGame", authMiddleware, requireAdmin, validateAddGame, addGame);
router.patch("/updateGame/:id", authMiddleware, requireAdmin, validateUpdateGame, updateGame);
router.delete("/deleteGame/:id", authMiddleware, requireAdmin, validateObjectId, deleteGame);

export default router;
