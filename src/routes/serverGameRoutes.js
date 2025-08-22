import express from "express";

const router = express.Router();

import {
  addGame,
  getAllGames,
  getGameById,
  updateGame,
  deleteGame,
  downloadGame,
} from "../controllers/serverGameController.js";

// Routes pour le CRUD
router.get("/getAllGames", getAllGames);
router.get("/getGameById/:id", getGameById);
router.post("/addGame", addGame);
router.patch("/updateGame/:id", updateGame);
router.delete("/deleteGame/:id", deleteGame);

// Routes Download
router.get("/downloadGame/:id", downloadGame);


export default router;
