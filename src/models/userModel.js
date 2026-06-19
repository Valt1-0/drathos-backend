import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ROLES, PASSWORD_REGEX, PASSWORD_MIN_LENGTH } from "../utils/constants.js";
import crypto from "crypto";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      validate: {
        validator: (v) => v.length >= PASSWORD_MIN_LENGTH && PASSWORD_REGEX.test(v),
        message: "Password must be at least 8 characters and include uppercase, lowercase, digit and special character (@$!%*?&).",
      },
    },
    profilePicture: {
      type: String,
      default:
        "https://e7.pngegg.com/pngimages/84/165/png-clipart-united-states-avatar-organization-information-user-avatar-service-computer-wallpaper-thumbnail.png",
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.MEMBER,
    },
    isProfilePublic: {
      type: Boolean,
      default: true,
    },
    // Stores the SHA-256 hash of the current refresh token (never the raw token).
    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.setRefreshToken = function (rawToken) {
  this.refreshTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
};

UserSchema.methods.verifyRefreshToken = function (rawToken) {
  if (!this.refreshTokenHash || !this.refreshTokenExpiresAt) return false;
  if (this.refreshTokenExpiresAt < new Date()) return false;
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(this.refreshTokenHash));
};

UserSchema.index(
  { username: 1 },
  { collation: { locale: "en", strength: 2 }, name: "username_ci" }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", UserSchema);
