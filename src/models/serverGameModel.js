import mongoose from "mongoose";

const ServerGameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  summary: { type: String, default: "" },
  storyline: { type: String },
  genres: [
    {
      id: { type: Number, required: true },
      name: { type: String, required: true },
      slug: { type: String, required: true },
    },
  ],
  releaseDate: { type: Date },
  platforms: { type: [String] },
  rating: { type: Number },
  aggregatedRating: { type: Number },
  coverUrl: { type: String },
  igdbId: { type: Number, required: true },

  developer: { type: String },
  publisher: { type: String },

  zipFileName: { type: String, required: true },
  zipFilePath: { type: String, required: true },
  sha256: { type: String, default: null },
  version: { type: String, default: "1.0.0" },
  sizeMB: { type: Number },
  isPublic: { type: Boolean, default: true },
  multiplayer: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['online', 'local', 'both', null], default: null },
    maxPlayers: { type: Number, min: 1, max: 999, default: null },
    modes: [{ type: String, enum: ['co-op', 'pvp'] }]
  },
  executableName: { type: String },

  addedAt: { type: Date, default: Date.now },
});

ServerGameSchema.index({ igdbId: 1, version: 1 }, { unique: true });

export default mongoose.model("ServerGame", ServerGameSchema);
