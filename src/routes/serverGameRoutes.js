import express from "express";

const router = express.Router();

import {
  addGame,
  getAllGames,
  getGameById,
  updateGame,
  deleteGame,
} from "../controllers/serverGameController.js";

// Routes pour le CRUD
router.get("/getAllGames", getAllGames);
router.get("/getGameById/:id", getGameById);
router.post("/addGame", addGame);
router.patch("/updateGame/:id", updateGame);
router.delete("/deleteGame/:id", deleteGame);

export default router;
