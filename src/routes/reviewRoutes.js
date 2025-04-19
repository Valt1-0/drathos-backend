// routes/reviewRoutes.js
import express from "express";
import {
  addOrUpdateReview,
  getReviewsByGame,
  deleteReview,
  getReviewByGameAndUser,
} from "../controllers/reviewController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js"; // Middleware pour l'authentification

const router = express.Router();

router.post("/addOrUpdateReview/:gameId", authMiddleware, addOrUpdateReview);
router.get("/getReviewsByGame/:gameId", getReviewsByGame);
router.get("/getReviewByGameAndUser/:gameId", authMiddleware, getReviewByGameAndUser);
router.delete("/deleteReview/:gameId/:reviewId", authMiddleware, deleteReview);

export default router;
