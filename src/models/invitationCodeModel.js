import mongoose from "mongoose";

// Single-use invitation codes for registering while registration is disabled.
// A code is consumed atomically (usedAt set via findOneAndUpdate) so two
// concurrent registrations can never share one.
const InvitationCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("InvitationCode", InvitationCodeSchema);
