import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import InstalledGame from "../models/installedGameModel.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONSTANTS ====================
const JWT_TOKEN = process.env.JWT_TOKEN;
const JWT_EXPIRES_IN = "30d";
const UPLOAD_DIR = path.join(__dirname, "../../serverData/users");
const PROFILE_URL_PREFIX = "/serverData/users/";
const DEFAULT_PROFILE_PICTURE = null;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ==================== HELPERS ====================

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
    jwt.sign(
      payload,
      JWT_TOKEN,
      { expiresIn: JWT_EXPIRES_IN },
      (err, token) => {
        if (err) reject(err);
        else resolve(token);
      },
    );
  });
};

const deleteProfileFile = async (profilePicture) => {
  if (!profilePicture?.includes(PROFILE_URL_PREFIX)) return;

  const filename = profilePicture.split(PROFILE_URL_PREFIX)[1];
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT")
      console.error("Error deleting profile file:", err);
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

// ==================== MULTER CONFIG ====================

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

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("profilePicture");

// ==================== AUTH ====================

export const register = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (await User.exists({ username })) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const isFirstUser = (await User.countDocuments()) === 0;
    const user = await User.create({
      username,
      password,
      role: isFirstUser ? "admin" : "member",
    });

    const token = await signToken(user);
    res.json({ token, message: "User registered successfully" });
  } catch (err) {
    console.error("[userController] register error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = await signToken(user);
    res.json({ token });
  } catch (err) {
    console.error("[userController] login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// ==================== PROFILES ====================

export const getAllUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      isProfilePublic: { $ne: false },
      ...(search && { username: { $regex: search, $options: "i" } }),
    };

    const [users, total] = await Promise.all([
      User.find(query)
        .select("_id username profilePicture role createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query),
    ]);

    // Single aggregation for all users' stats
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
    console.error("[userController] getAllUsers error:", error);
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
    console.error("[userController] getUserProfile error:", error);
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
    console.error("[userController] updateProfileVisibility error:", error);
    res.status(500).json({ message: "Server error while updating visibility" });
  }
};

export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user.id)
      .select("profilePicture")
      .lean();
    if (!user) {
      await fs.unlink(req.file.path);
      return res.status(404).json({ message: "User not found" });
    }

    // Delete old picture
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
    console.error("[userController] uploadProfilePicture error:", error);
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
    console.error("[userController] deleteProfilePicture error:", error);
    res
      .status(500)
      .json({ message: "Server error while deleting profile picture" });
  }
};

// ==================== ADMIN ====================

const VALID_ROLES = ["admin", "moderator", "member"];

export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
      });
    }

    // Prevent self-demotion
    if (req.user.id === userId) {
      return res.status(400).json({
        message: "You cannot change your own role"
      });
    }

    const user = await User.findById(userId).select("_id username role").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent demoting other admins (only the user themselves or a "super" mechanism could do that)
    if (user.role === "admin" && role !== "admin") {
      return res.status(403).json({
        message: "Cannot demote another admin"
      });
    }

    await User.updateOne({ _id: userId }, { role });

    res.json({
      message: `User ${user.username} role updated to ${role}`,
      user: { _id: user._id, username: user.username, role }
    });
  } catch (error) {
    console.error("[userController] updateUserRole error:", error);
    res.status(500).json({ message: "Server error while updating user role" });
  }
};
