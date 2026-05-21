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

import { authMiddleware, requireAdminOrModerator } from "../middlewares/authMiddleware.js";
import { downloadLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.get("/getAllGames", authMiddleware, getAllGames);
router.get("/getGameById/:id", authMiddleware, validateObjectId, getGameById);
router.get("/downloadGame/:id", authMiddleware, validateObjectId, downloadLimiter, downloadGame);

router.post("/addGame", authMiddleware, requireAdminOrModerator, validateAddGame, addGame);
router.patch("/updateGame/:id", authMiddleware, requireAdminOrModerator, validateUpdateGame, updateGame);
router.delete("/deleteGame/:id", authMiddleware, requireAdminOrModerator, validateObjectId, deleteGame);

export default router;
