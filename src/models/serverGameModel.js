import mongoose from "mongoose";

const gameGenres = [
  "action",
  "adventure",
  "strategy",
  "puzzle",
  "rpg",
  "shooter",
  "simulation",
];

const ServerGameSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  genres: {
    type: [String],
    required: true,
    enum: gameGenres, // Valide que le genre appartient à l'une des valeurs définies
  },
  zipFileName: {
    type: String,
    required: true,
  },
  zipFilePath: {
    type: String,
    required: true,
  },
  version: {
    type: String,
    default: "1.0.0",
  },
  sizeMB: {
    type: Number,
  },
  releaseDate: {
    type: Date,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  isPublic: {
    type: Boolean,
    default: true,
  },
});

export default mongoose.model("ServerGame", ServerGameSchema);
