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
  platforms: { type: [String] }, // noms, pas juste les IDs
  rating: { type: Number }, // IGDB user rating
  aggregatedRating: { type: Number }, // critic + user
  coverUrl: { type: String }, // URL vers image IGDB
  igdbId: { type: Number, required: true, unique: true },

  zipFileName: { type: String, required: true },
  zipFilePath: { type: String, required: true },
  version: { type: String, default: "1.0.0" },
  sizeMB: { type: Number },
  isPublic: { type: Boolean, default: true },

  addedAt: { type: Date, default: Date.now },
  avgRating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
});

export default mongoose.model("ServerGame", ServerGameSchema);
