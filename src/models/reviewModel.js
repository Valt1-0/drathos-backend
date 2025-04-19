// models/reviewModel.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServerGame",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt automatiquement
  }
);

reviewSchema.index({ game: 1, user: 1 }, { unique: true }); // 1 seul review par jeu/user

const Review = mongoose.model("Review", reviewSchema);
export default Review;
