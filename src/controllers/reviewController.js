// controllers/reviewController.js
import Review from "../models/reviewModel.js";
import ServerGame from "../models/serverGameModel.js";
import { log } from "console";

// Créer ou mettre à jour une review
export const addOrUpdateReview = async (req, res) => {
  const { rating, comment } = req.body;
  const gameId = req.params.gameId;
  const userId = req.user._id; // Assure-toi que `req.user` contient l'utilisateur authentifié

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5." });
  }

  try {
    const gameExists = await ServerGame.findById(gameId);
    if (!gameExists) {
      return res.status(404).json({ message: "Game not found." });
    }

    const existingReview = await Review.findOne({ game: gameId, user: userId });

    if (existingReview) {
      // Update review
      existingReview.rating = rating;
      if (comment !== undefined) existingReview.comment = comment?.trim();
      await existingReview.save();
      return res
        .status(200)
        .json({ message: "Review updated.", review: existingReview });
    } else {
      // New review
      const review = new Review({
        game: gameId,
        user: userId,
        rating,
        comment: comment?.trim(),
      });
      await review.save();
      return res.status(201).json({ message: "Review added.", review });
    }
  } catch (error) {
    console.error("[addOrUpdateReview] Error:", error.message);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// Récupérer toutes les reviews d'un jeu
export const getReviewsByGame = async (req, res) => {
  const gameId = req.params.gameId;

  try {
    const gameExists = await ServerGame.findById(gameId);
    if (!gameExists) {
      return res.status(404).json({ message: "Game not found." });
    }

    const reviews = await Review.find({ game: gameId }).populate(
      "user",
      "username email"
    ); // Ajoute des infos de l'utilisateur
    res.status(200).json(reviews);
  } catch (error) {
    console.error("[getReviewsByGame] Error:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching reviews.", error: error.message });
  }
};

// Récupérer une review par jeu et utilisateur
export const getReviewByGameAndUser = async (req, res) => {
  const { gameId } = req.params;
  const userId = req.user._id;

  try {
    const review = await Review.findOne({ game: gameId, user: userId });
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    res.status(200).json(review);
  } catch (error) {
    console.error("[getReviewByGameAndUser] Error:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching review.", error: error.message });
  }
};

// Supprimer une review
export const deleteReview = async (req, res) => {
  const { gameId, reviewId } = req.params;
  const userId = req.user._id;

  try {
    const review = await Review.findOne({
      _id: reviewId,
      game: gameId,
      user: userId,
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    await review.remove();
    res.status(200).json({ message: "Review deleted." });
  } catch (error) {
    console.error("[deleteReview] Error:", error.message);
    res
      .status(500)
      .json({ message: "Error deleting review.", error: error.message });
  }
};
