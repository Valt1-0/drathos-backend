import mongoose from "mongoose";

const ServerSettingsSchema = new mongoose.Schema({
  // Unique key enforces a single settings document (blocks duplicate creation
  // on concurrent first reads, which would break the admin-bootstrap lock).
  key: { type: String, default: "singleton", unique: true, immutable: true },
  maxModSizeGB: { type: Number, default: 2, min: 0.1, max: 100 },
  maxGameSizeGB: { type: Number, default: 50, min: 1, max: 2000 },
  registrationEnabled: { type: Boolean, default: true },
  adminBootstrapped: { type: Boolean, default: false },
}, {
  timestamps: true,
});

export default mongoose.model("ServerSettings", ServerSettingsSchema);
