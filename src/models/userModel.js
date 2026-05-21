import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ROLES, PASSWORD_REGEX, PASSWORD_MIN_LENGTH } from "../utils/constants.js";

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
  },
  {
    timestamps: true,
  }
);

UserSchema.index(
  { username: 1 },
  { collation: { locale: "en", strength: 2 }, name: "username_ci" }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", UserSchema);
