import mongoose from "mongoose";

const CollectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  description: {
    type: String,
    maxlength: 500,
    default: ""
  },

  type: {
    type: String,
    enum: ["custom", "smart"],
    default: "custom"
  },

  smartFilter: {
    type: {
      type: String,
      enum: ["recentlyPlayed", "installed", "notInstalled", "favorites", "mostPlayed"],
    },
    params: {
      type: mongoose.Schema.Types.Mixed,
    }
  },

  games: [{
    serverGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServerGame",
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    order: {
      type: Number,
      default: 0
    }
  }],

  icon: {
    type: String,
    default: "FaFolder"
  },

  color: {
    type: String,
    default: "#6366f1"
  },

  isPublic: {
    type: Boolean,
    default: false
  },

  isPinned: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

CollectionSchema.index({ userId: 1, name: 1 }, { unique: true });
CollectionSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
CollectionSchema.index({ "games.serverGameId": 1 });

CollectionSchema.methods.addGame = function(gameId) {
  const exists = this.games.find(g => g.serverGameId.toString() === gameId.toString());
  if (!exists) {
    const maxOrder = Math.max(...this.games.map(g => g.order), -1);
    this.games.push({
      serverGameId: gameId,
      order: maxOrder + 1
    });
  }
};

CollectionSchema.methods.removeGame = function(gameId) {
  this.games = this.games.filter(g => g.serverGameId.toString() !== gameId.toString());
};

CollectionSchema.methods.reorderGames = function(gameOrders) {
  gameOrders.forEach(({ gameId, order }) => {
    const game = this.games.find(g => g.serverGameId.toString() === gameId.toString());
    if (game) {
      game.order = order;
    }
  });
  this.games.sort((a, b) => a.order - b.order);
};

export default mongoose.model("Collection", CollectionSchema);
