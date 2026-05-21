import mongoose from "mongoose";

const installedGameSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serverGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServerGame",
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    version: {
      type: String,
      default: "1.0.0",
    },
    stats: {
      totalPlayTime: {
        type: Number,
        default: 0,
      },
      totalSessions: {
        type: Number,
        default: 0,
      },
      lastPlayed: {
        type: Number,
        default: null,
      },
      firstLaunched: {
        type: Number,
        default: null,
      },
      currentSession: {
        startTime: {
          type: Number,
          default: null,
        },
        isPlaying: {
          type: Boolean,
          default: false,
        },
      },
      achievements: [
        {
          name: String,
          description: String,
          unlockedAt: Date,
        },
      ],
      customStats: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
      },
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
    installSize: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

installedGameSchema.index({ userId: 1, serverGameId: 1 }, { unique: true });
installedGameSchema.index({ "stats.lastPlayed": -1 });
installedGameSchema.index({ "stats.totalPlayTime": -1 });

export default mongoose.model("InstalledGame", installedGameSchema);
