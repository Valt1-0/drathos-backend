import mongoose from "mongoose";

// Multi-use codes for registering while registration is disabled. A slot is
// reserved atomically (usedCount vs maxUses) so concurrent registrations can
// never exceed the limit; the consuming user is recorded in `uses`.
const InvitationCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, default: null },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    uses: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("InvitationCode", InvitationCodeSchema);
