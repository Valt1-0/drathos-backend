import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";
import { revokeToken } from "../middlewares/authMiddleware.js";
import { ROLES, JWT_EXPIRES_IN, MAX_PROFILE_PIC_SIZE } from "../utils/constants.js";
import crypto from "crypto";
import User from "../models/userModel.js";
import InstalledGame from "../models/installedGameModel.js";
import InvitationCode from "../models/invitationCodeModel.js";
import ServerSettings from "../models/serverSettingsModel.js";
import { getSettings } from "../utils/serverSettings.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_TOKEN = process.env.JWT_TOKEN;
const UPLOAD_DIR = path.join(__dirname, "../../serverData/users");
const PROFILE_URL_PREFIX = "/serverData/users/";
const DEFAULT_PROFILE_PICTURE = null;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const signToken = (user) => {
  return new Promise((resolve, reject) => {
    const payload = {
      user: {
        id: user.id || user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        role: user.role,
      },
    };
    jwt.sign(payload, JWT_TOKEN, { expiresIn: JWT_EXPIRES_IN }, (err, token) => {
      if (err) reject(err);
      else resolve(token);
    });
  });
};

const generateRefreshToken = () => crypto.randomBytes(40).toString("hex");

const deleteProfileFile = async (profilePicture) => {
  if (!profilePicture?.includes(PROFILE_URL_PREFIX)) return;

  const filename = profilePicture.split(PROFILE_URL_PREFIX)[1];
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT")
      logger.error("Error deleting profile file:", err);
  }
};

const getUserStats = async (userId) => {
  const [stats] = await InstalledGame.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalPlayTime: { $sum: "$stats.totalPlayTime" },
        totalSessions: { $sum: "$stats.totalSessions" },
        gamesInstalled: { $sum: 1 },
        gamesPlayed: {
          $sum: { $cond: [{ $gt: ["$stats.totalSessions", 0] }, 1, 0] },
        },
      },
    },
  ]);

  return (
    stats || {
      totalPlayTime: 0,
      totalSessions: 0,
      gamesInstalled: 0,
      gamesPlayed: 0,
    }
  );
};

const getBulkUserStats = async (userIds) => {
  const stats = await InstalledGame.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: "$userId",
        totalPlayTime: { $sum: "$stats.totalPlayTime" },
        totalSessions: { $sum: "$stats.totalSessions" },
        gamesInstalled: { $sum: 1 },
        gamesPlayed: {
          $sum: { $cond: [{ $gt: ["$stats.totalSessions", 0] }, 1, 0] },
        },
      },
    },
  ]);

  return new Map(stats.map((s) => [s._id.toString(), s]));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
};

const validateImageMagicBytes = async (filePath) => {
  const buf = Buffer.alloc(12);
  const fh = await fs.open(filePath, "r");
  try {
    await fh.read(buf, 0, 12, 0);
  } finally {
    await fh.close();
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true; // GIF
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // WebP: RIFF....WEBP
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_PROFILE_PIC_SIZE },
}).single("profilePicture");

export const register = async (req, res) => {
  const { username, password, inviteCode } = req.body;

  let claimedInvite = null;
  try {
    if (await User.exists({ username })) {
      return res
        .status(400)
        .json({ error: true, message: "User already exists" });
    }

    const settings = await getSettings();
    const isFirstUser = (await User.countDocuments()) === 0;

    // Closed registration requires a valid code (the very first account is
    // always allowed so a fresh server can be set up).
    if (!isFirstUser && settings.registrationEnabled === false) {
      const code = typeof inviteCode === "string" ? inviteCode.trim().toUpperCase() : "";
      if (!code) {
        return res.status(403).json({
          error: true,
          code: "REGISTRATION_DISABLED",
          message: "Registration is disabled on this server. An invitation code is required.",
        });
      }
      // Atomically reserve a slot only while under maxUses — concurrent
      // registrations can never push a code past its limit.
      claimedInvite = await InvitationCode.findOneAndUpdate(
        {
          code,
          revoked: { $ne: true },
          $expr: { $lt: ["$usedCount", "$maxUses"] },
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
      if (!claimedInvite) {
        return res.status(403).json({
          error: true,
          code: "INVALID_INVITE",
          message: "Invalid, expired, revoked or fully used invitation code.",
        });
      }
    }

    // Atomic admin election: only the registration that flips the flag on the
    // singleton doc wins (non-null result); a concurrent one gets null.
    let role = "member";
    if (isFirstUser) {
      const won = await ServerSettings.findOneAndUpdate(
        { key: "singleton", adminBootstrapped: { $ne: true } },
        { $set: { adminBootstrapped: true } }
      );
      if (won) role = "admin";
    }

    const user = await User.create({ username, password, role });

    if (claimedInvite) {
      await InvitationCode.updateOne(
        { _id: claimedInvite._id },
        { $push: { uses: { user: user._id, usedAt: new Date() } } }
      ).catch(() => {});
    }

    const refreshToken = generateRefreshToken();
    const [token] = await Promise.all([
      signToken(user),
      (async () => { user.setRefreshToken(refreshToken); await user.save(); })(),
    ]);

    res.json({ token, refreshToken, message: "User registered successfully" });
  } catch (err) {
    // Release the reserved slot if user creation failed after claiming it
    if (claimedInvite) {
      await InvitationCode.updateOne(
        { _id: claimedInvite._id },
        { $inc: { usedCount: -1 } }
      ).catch(() => {});
    }
    logger.error("[userController] register error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username }).select("+refreshTokenHash +refreshTokenExpiresAt");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ error: true, message: "Invalid credentials" });
    }

    const [accessToken, refreshToken] = await Promise.all([
      signToken(user),
      Promise.resolve(generateRefreshToken()),
    ]);

    user.setRefreshToken(refreshToken);
    await user.save();

    res.json({ token: accessToken, refreshToken });
  } catch (err) {
    logger.error("[userController] login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required." });
  }

  try {
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const user = await User.findOne({
      refreshTokenHash: hash,
      refreshTokenExpiresAt: { $gt: new Date() },
    }).select("+refreshTokenHash +refreshTokenExpiresAt");

    if (!user) {
      return res.status(401).json({ message: "Invalid or expired refresh token." });
    }

    // Rolling session: issue a new refresh token so the 7-day window resets on each use.
    // The old token is immediately replaced in the DB — it cannot be reused.
    const newRefreshToken = generateRefreshToken();
    const [newAccessToken] = await Promise.all([
      signToken(user),
      (async () => { user.setRefreshToken(newRefreshToken); await user.save(); })(),
    ]);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    logger.error("[userController] refreshAccessToken error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const safeSearch = search.trim().substring(0, 50);

    const query = {
      isProfilePublic: { $ne: false },
      ...(safeSearch && { username: { $regex: escapeRegex(safeSearch), $options: "i" } }),
    };

    const collation = { locale: "en", strength: 2 };

    const [users, total] = await Promise.all([
      User.find(query)
        .collation(collation)
        .select("_id username profilePicture role createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query).collation(collation),
    ]);

    const statsMap = await getBulkUserStats(users.map((u) => u._id));

    const usersWithStats = users.map((user) => {
      const stats = statsMap.get(user._id.toString()) || {
        totalPlayTime: 0,
        totalSessions: 0,
        gamesInstalled: 0,
        gamesPlayed: 0,
      };
      return { ...user, stats };
    });

    res.json({
      users: usersWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error("[userController] getAllUsers error:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("_id username profilePicture role createdAt isProfilePublic")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isProfilePublic === false && req.user?.id !== userId) {
      return res.status(403).json({ message: "This profile is private" });
    }

    const [stats, recentGames] = await Promise.all([
      getUserStats(user._id),
      InstalledGame.find({
        userId: user._id,
        "stats.lastPlayed": { $ne: null },
      })
        .sort({ "stats.lastPlayed": -1 })
        .limit(8)
        .populate("serverGameId", "name coverUrl genres")
        .lean(),
    ]);

    res.json({
      user: { ...user, isProfilePublic: user.isProfilePublic !== false },
      stats,
      recentGames: recentGames.map((g) => ({
        _id: g.serverGameId?._id,
        name: g.serverGameId?.name,
        coverUrl: g.serverGameId?.coverUrl,
        genres: g.serverGameId?.genres,
        totalPlayTime: g.stats?.totalPlayTime || 0,
        totalSessions: g.stats?.totalSessions || 0,
        lastPlayed: g.stats?.lastPlayed,
      })),
    });
  } catch (error) {
    logger.error("[userController] getUserProfile error:", error);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

export const updateProfileVisibility = async (req, res) => {
  try {
    const { isPublic } = req.body;

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({ message: "isPublic must be a boolean" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { isProfilePublic: isPublic },
      { new: true, select: "_id username isProfilePublic" },
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: `Profile visibility updated to ${isPublic ? "public" : "private"}`,
      isProfilePublic: user.isProfilePublic,
    });
  } catch (error) {
    logger.error("[userController] updateProfileVisibility error:", error);
    res.status(500).json({ message: "Server error while updating visibility" });
  }
};

export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!(await validateImageMagicBytes(req.file.path))) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ message: "Invalid file type" });
    }

    const user = await User.findById(req.user.id)
      .select("profilePicture")
      .lean();
    if (!user) {
      await fs.unlink(req.file.path);
      return res.status(404).json({ message: "User not found" });
    }

    await deleteProfileFile(user.profilePicture);

    const profilePicture = `${PROFILE_URL_PREFIX}${req.file.filename}`;

    await User.updateOne({ _id: req.user.id }, { profilePicture });

    res.json({
      message: "Profile picture uploaded successfully",
      profilePicture,
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    logger.error("[userController] uploadProfilePicture error:", error);
    res
      .status(500)
      .json({ message: "Server error while uploading profile picture" });
  }
};

export const deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("profilePicture")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await deleteProfileFile(user.profilePicture);
    await User.updateOne(
      { _id: req.user.id },
      { profilePicture: DEFAULT_PROFILE_PICTURE },
    );

    res.json({
      message: "Profile picture deleted successfully",
      profilePicture: DEFAULT_PROFILE_PICTURE,
    });
  } catch (error) {
    logger.error("[userController] deleteProfilePicture error:", error);
    res
      .status(500)
      .json({ message: "Server error while deleting profile picture" });
  }
};

const VALID_ROLES = Object.values(ROLES);

export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    if (req.user.id === userId) {
      return res.status(400).json({
        message: "You cannot change your own role",
      });
    }

    const user = await User.findById(userId).select("_id username role").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role === ROLES.ADMIN) {
      return res
        .status(403)
        .json({ message: "The admin role cannot be assigned" });
    }

    if (user.role === ROLES.ADMIN) {
      return res.status(403).json({ message: "Cannot change an admin's role" });
    }

    const previousRole = user.role;
    await User.updateOne({ _id: userId }, { role });

    logger.info(`[audit] role_change by=${req.user.username}(${req.user.id}) target=${user.username}(${userId}) ${previousRole} → ${role}`);

    res.json({
      message: `User ${user.username} role updated to ${role}`,
      user: { _id: user._id, username: user.username, role },
    });
  } catch (error) {
    logger.error("[userController] updateUserRole error:", error);
    res.status(500).json({ message: "Server error while updating user role" });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (token) revokeToken(token);

    // Invalidate refresh token for this user
    await User.findByIdAndUpdate(req.user.id, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    logger.error("[logout] Error:", error.message);
    res.status(500).json({ message: "Server error during logout." });
  }
};
