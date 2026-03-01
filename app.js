import "dotenv/config.js";
import logger from "./src/utils/logger.js";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import { connect } from "./src/db/mongoConnect.js";
import { setIO } from "./src/socket.js";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { apiLimiter } from "./src/middlewares/rateLimitMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importation des middlewares de sécurité
import {
  corsConfig,
  helmetConfig,
} from "./src/middlewares/securityMiddleware.js";

import {
  errorHandler,
  notFoundHandler,
} from "./src/middlewares/errorMiddleware.js";

// Routes
import serverRoute from "./src/routes/serverRoutes.js";
import userRoute from "./src/routes/userRoutes.js";
import serverGameRoute from "./src/routes/serverGameRoutes.js";
import igdbRoute from "./src/routes/igdbRoutes.js";
import installedGamesRoute from "./src/routes/installedGamesRoutes.js";
import collectionRoute from "./src/routes/collectionRoutes.js";
import modRoute from "./src/routes/modRoutes.js";

// Services de cleanup
import { cleanupStuckSessions } from "./src/controllers/installedGameController.js";

const API_PORT = process.env.API_PORT || 5001;

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : "*",
    methods: ["GET", "POST"],
  },
});

// Store io instance for use in controllers
setIO(io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Client connecté: ${socket.id}`);
  socket.on("disconnect", () => logger.info(`Client déconnecté: ${socket.id}`));
});

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connect();

    // 🧹 Cleanup des sessions bloquées au démarrage
    await cleanupStuckSessions();

    // Créer le dossier logs s'il n'existe pas
    const logsDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // 📁 Servir les fichiers statiques (serverData) AVANT Helmet pour éviter les restrictions CORS
    app.use("/serverData", (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    }, express.static(path.join(__dirname, "serverData")));

    // 🔒 MIDDLEWARES DE SÉCURITÉ (ORDRE IMPORTANT)
    app.use(helmetConfig);
    app.use(corsConfig);
    app.use(compression());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request ID — traçabilité dans les logs
    app.use((req, res, next) => {
      req.id = randomUUID();
      res.setHeader("X-Request-Id", req.id);
      next();
    });

    // Rate limiting global
    app.use("/api/", apiLimiter);

    // Logging des requêtes
    app.use((req, res, next) => {
      logger.info(`[${req.id}] ${req.method} ${req.url} - IP: ${req.ip}`);
      next();
    });

    // Routes avec préfixes sécurisés
    app.use("/api/server", serverRoute);
    app.use("/api/users", userRoute);
    app.use("/api/serverGame", serverGameRoute);
    app.use("/api/igdb", igdbRoute);
    app.use("/api/installedGames", installedGamesRoute);
    app.use("/api/collections", collectionRoute);
    app.use("/api/mods", modRoute);

    // Route racine
    app.get("/", (req, res) => {
      res.json({
        message: "Drathos API Server",
        version: "0.7.0",
        status: "running",
        timestamp: new Date().toISOString(),
      });
    });

    // 🚨 MIDDLEWARES D'ERREUR (À LA FIN)
    app.use(notFoundHandler); // Routes non trouvées
    app.use(errorHandler); // Gestion d'erreurs centralisée

    // Démarrage serveur
    httpServer.listen(API_PORT, () => {
      logger.info(`Serveur Drathos démarré sur le port ${API_PORT}`);
      logger.info(`Socket.IO activé`);
      logger.info(`Sécurité activée : Helmet, CORS, Rate Limiting`);
      logger.info(`Logs disponibles dans ./logs/`);
    });

    return app;
  } catch (error) {
    logger.error("Erreur au démarrage du serveur:", error);
    process.exit(1);
  }
};

startServer();

const shutdown = async (signal) => {
  logger.info(`\n${signal} reçu — arrêt propre du serveur...`);
  // Force kill si pas terminé en 10s
  setTimeout(() => process.exit(1), 10000).unref();
  await new Promise((resolve) => httpServer.close(resolve));
  const { default: mongoose } = await import("mongoose");
  await mongoose.connection.close();
  logger.info("Connexion MongoDB fermée.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
