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

// Routes publiques
router.get("/getAllGames", getAllGames);
router.get("/getGameById/:id", validateObjectId, getGameById);

router.get("/downloadGame/:id", authMiddleware, validateObjectId, downloadGame);

// Routes admin uniquement
router.post("/addGame", authMiddleware, requireAdmin, validateAddGame, addGame);
router.patch("/updateGame/:id", authMiddleware, requireAdmin, validateUpdateGame, updateGame);
router.delete("/deleteGame/:id", authMiddleware, requireAdmin, validateObjectId, deleteGame);

export default router;
