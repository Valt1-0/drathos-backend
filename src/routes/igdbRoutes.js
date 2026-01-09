import express from "express";
import {
  searchGames,
  fetchGameDetails,
} from "../controllers/igdbController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Routes protégées (évite l'abus de l'API IGDB)
router.get("/search", authMiddleware, searchGames);
router.get("/fetch/:id", authMiddleware, fetchGameDetails);

export default router;
