import mongoose from "mongoose";

const ModSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServerGame",
    required: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  author: { type: String, trim: true },
  version: { type: String, default: "1.0.0" },
  zipFileName: { type: String, required: true },
  zipFilePath: { type: String, required: true },
  installPath: { type: String, default: "Mods" },
  sizeMB: { type: Number },
  modType: {
    type: String,
    enum: ['gameplay', 'visual', 'audio', 'total-conversion', 'other'],
    default: 'other'
  },
  compatibleGameVersions: { type: [String], default: [] },
  platform: {
    type: [String],
    enum: ['win32', 'linux', 'darwin'],
    default: ['win32', 'linux', 'darwin']
  },
  isPublic: { type: Boolean, default: true },
  downloads: { type: Number, default: 0 },
}, {
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

// Index composite unique pour permettre plusieurs versions du même mod pour un jeu
ModSchema.index({ gameId: 1, name: 1, version: 1 }, { unique: true });

// Index pour rechercher les mods par jeu rapidement
ModSchema.index({ gameId: 1 });

export default mongoose.model("Mod", ModSchema);
