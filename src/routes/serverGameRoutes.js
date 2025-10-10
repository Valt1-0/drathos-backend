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

const router = express.Router();

router.get("/getAllGames", getAllGames);
router.get("/getGameById/:id", validateObjectId, getGameById);
router.post("/addGame", validateAddGame, addGame);
router.patch("/updateGame/:id", validateUpdateGame, updateGame);
router.delete("/deleteGame/:id", validateObjectId, deleteGame);

// Route download
router.get("/downloadGame/:id", validateObjectId, downloadGame);

export default router;
