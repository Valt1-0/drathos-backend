import mongoose from "mongoose";

const ServerSettingsSchema = new mongoose.Schema({
  maxModSizeGB: { type: Number, default: 2, min: 0.1, max: 100 },
  maxGameSizeGB: { type: Number, default: 50, min: 1, max: 2000 },
}, {
  timestamps: true,
});

export default mongoose.model("ServerSettings", ServerSettingsSchema);
