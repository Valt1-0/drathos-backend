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
  igdbId: { type: Number, required: true },

  developer: { type: String }, // Nom du développeur
  publisher: { type: String }, // Nom de l'éditeur

  zipFileName: { type: String, required: true },
  zipFilePath: { type: String, required: true },
  version: { type: String, default: "1.0.0" },
  sizeMB: { type: Number },
  isPublic: { type: Boolean, default: true },
  multiplayer: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['online', 'local', 'both', null], default: null },
    maxPlayers: { type: Number, min: 1, max: 999, default: null },
    modes: [{ type: String, enum: ['co-op', 'pvp'] }]
  },
  executableName: { type: String }, // Nom de l'exécutable à lancer (ex: "game.exe", "bin/server.exe")

  addedAt: { type: Date, default: Date.now },
});

// Index composite unique pour permettre plusieurs versions du même jeu
ServerGameSchema.index({ igdbId: 1, version: 1 }, { unique: true });

export default mongoose.model("ServerGame", ServerGameSchema);
