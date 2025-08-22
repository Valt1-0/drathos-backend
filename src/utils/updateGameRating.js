// utils/updateGameRating.js
import Review from "../models/reviewModel.js";
import ServerGame from "../models/serverGameModel.js";
import mongoose from "mongoose";

export const updateGameRating = async (gameId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { game: new mongoose.Types.ObjectId(gameId) } },
      {
        $group: {
          _id: "$game",
          avgRating: { $avg: "$rating" },
          numReviews: { $sum: 1 },
        },
      },
    ]);

    console.log("[updateGameRating] Game ID:", gameId); // Log game ID for debugging

    console.log("[updateGameRating] Stats:", stats); // Log stats for debugging

    if (stats.length > 0) {
      const { avgRating, numReviews } = stats[0];
      await ServerGame.findByIdAndUpdate(gameId, {
        avgRating: Math.round(avgRating * 2) / 2, // 👈 arrondi à 0.5 près (ex: 3.5, 4.0 etc)
        numReviews,
      });
    } else {
      // Aucune review : reset
      await ServerGame.findByIdAndUpdate(gameId, {
        avgRating: 0,
        numReviews: 0,
      });
    }
  } catch (error) {
    console.error("[updateGameRating] Error:", error.message);
  }
};
