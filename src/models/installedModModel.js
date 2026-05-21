import mongoose from "mongoose";

const installedModSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    modId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mod",
      required: true,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServerGame",
      required: true,
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

installedModSchema.index({ userId: 1, modId: 1 }, { unique: true });
installedModSchema.index({ userId: 1 });
installedModSchema.index({ userId: 1, gameId: 1 });

export default mongoose.model("InstalledMod", installedModSchema);
