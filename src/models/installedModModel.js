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
    enabled: {
      type: Boolean,
      default: true,
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsed: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index unique : un user ne peut installer le même mod qu'une fois
installedModSchema.index({ userId: 1, modId: 1 }, { unique: true });

// Index pour récupérer rapidement les mods d'un user
installedModSchema.index({ userId: 1 });

// Index pour récupérer rapidement les mods d'un jeu pour un user
installedModSchema.index({ userId: 1, gameId: 1 });

export default mongoose.model("InstalledMod", installedModSchema);
