import mongoose from "mongoose";

const ServerSettingsSchema = new mongoose.Schema({
  // Fixed key enforces a single settings document — a unique index makes two
  // concurrent "create on first read" attempts collapse to one row instead of
  // silently creating duplicates (which would break the admin-bootstrap lock).
  key: { type: String, default: "singleton", unique: true, immutable: true },
  maxModSizeGB: { type: Number, default: 2, min: 0.1, max: 100 },
  maxGameSizeGB: { type: Number, default: 50, min: 1, max: 2000 },
  // When false, /register requires a valid invitation code (first user always allowed)
  registrationEnabled: { type: Boolean, default: true },
  // Set atomically by the first successful registration — guards against two
  // concurrent registrations on a fresh server both becoming admin
  adminBootstrapped: { type: Boolean, default: false },
}, {
  timestamps: true,
});

export default mongoose.model("ServerSettings", ServerSettingsSchema);
