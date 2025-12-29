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

  // Type de collection
  type: {
    type: String,
    enum: ["custom", "smart"],
    default: "custom"
  },

  // Pour les collections intelligentes ("smart")
  smartFilter: {
    type: {
      type: String,
      enum: ["recentlyPlayed", "installed", "notInstalled", "favorites", "mostPlayed"],
    },
    params: {
      type: mongoose.Schema.Types.Mixed, // Paramètres flexibles
    }
  },

  // Liste des jeux (pour collections custom uniquement)
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
      default: 0 // Pour le drag & drop
    }
  }],

  // Métadonnées visuelles
  icon: {
    type: String,
    default: "FaFolder" // Icône React Icons
  },

  color: {
    type: String,
    default: "#6366f1" // Couleur hex
  },

  // Visibilité
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

// Index composés pour performance
CollectionSchema.index({ userId: 1, name: 1 }, { unique: true });
CollectionSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
CollectionSchema.index({ "games.serverGameId": 1 });

// Méthode pour ajouter un jeu
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

// Méthode pour retirer un jeu
CollectionSchema.methods.removeGame = function(gameId) {
  this.games = this.games.filter(g => g.serverGameId.toString() !== gameId.toString());
};

// Méthode pour réorganiser les jeux
CollectionSchema.methods.reorderGames = function(gameOrders) {
  gameOrders.forEach(({ gameId, order }) => {
    const game = this.games.find(g => g.serverGameId.toString() === gameId.toString());
    if (game) {
      game.order = order;
    }
  });
  // Trier par ordre
  this.games.sort((a, b) => a.order - b.order);
};

export default mongoose.model("Collection", CollectionSchema);
