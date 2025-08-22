import express from "express";
import {
  searchGames,
  fetchGameDetails,
} from "../controllers/igdbController.js";

const router = express.Router();

router.get("/search", searchGames);
router.get("/fetch/:id", fetchGameDetails);

export default router;
