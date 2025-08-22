import mongoose from "mongoose";

const installedGameSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  serverGameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServerGame",
    required: true,
  },
  installedAt: { type: Date, default: Date.now },
  path: { type: String, required: true },
  version: { type: String },
});

export default mongoose.model("InstalledGame", installedGameSchema);
