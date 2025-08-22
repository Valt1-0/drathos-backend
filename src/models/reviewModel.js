import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServerGame",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      // S'assurer que la note est un multiple de 0.5
      validate: {
        validator: function (v) {
          return v % 0.5 === 0;
        },
        message: (props) =>
          `${props.value} n'est pas une note valide. Utilisez des demi-notes comme 1, 1.5, 2, 2.5, 3, etc.`,
      },
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt auto
  }
);

// 1 seul avis par (game,user)
reviewSchema.index({ game: 1, user: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
