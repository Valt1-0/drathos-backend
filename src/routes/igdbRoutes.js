import express from "express";
import {
  searchGames,
  fetchGameDetails,
  getScreenshots,
} from "../controllers/igdbController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/search", authMiddleware, searchGames);
router.get("/screenshots/:igdbId", authMiddleware, getScreenshots);
router.get("/fetch/:id", authMiddleware, fetchGameDetails);

export default router;
