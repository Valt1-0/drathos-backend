import Review from "../models/reviewModel.js";
import ServerGame from "../models/serverGameModel.js";
import { updateGameRating } from "../utils/updateGameRating.js";

// Ajouter ou mettre à jour une review
export const addOrUpdateReview = async (req, res) => {
  const { rating, comment } = req.body;
  const { gameId } = req.params;
  const userId = req.user.id;

  if (!rating || rating < 0.5 || rating > 5) {
    return res
      .status(400)
      .json({ message: "Rating must be between 0.5 and 5." });
  }

  try {
    const game = await ServerGame.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found." });
    }

    const review = await Review.findOneAndUpdate(
      { game: gameId, user: userId },
      { rating, comment: comment?.trim() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await updateGameRating(gameId);

    res.status(200).json({ message: "Review added/updated.", review });
  } catch (error) {
    console.error("[addOrUpdateReview] Error:", error.message);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

// Récupérer toutes les reviews d'un jeu
export const getReviewsByGame = async (req, res) => {
  const { gameId } = req.params;

  try {
    const reviews = await Review.find({ game: gameId })
      .populate("user", "username email") // Ajoute infos user
      .sort({ createdAt: -1 }); // Les + récents en premier
    res.status(200).json(reviews);
  } catch (error) {
    console.error("[getReviewsByGame] Error:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching reviews.", error: error.message });
  }
};

// Récupérer la review d'un joueur pour un jeu
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

    await review.deleteOne();

    await updateGameRating(gameId);

    res.status(200).json({ message: "Review deleted." });
  } catch (error) {
    console.error("[deleteReview] Error:", error.message);
    res
      .status(500)
      .json({ message: "Error deleting review.", error: error.message });
  }
};
