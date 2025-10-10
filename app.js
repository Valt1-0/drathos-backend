import "dotenv/config.js";
import express from "express";
import { connect } from "./src/db/mongoConnect.js";
import fs from "fs";

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
import reviewRoute from "./src/routes/reviewRoutes.js";
import igdbRoute from "./src/routes/igdbRoutes.js";
import installedGamesRoute from "./src/routes/installedGamesRoutes.js";

// Services de cleanup
import { cleanupStuckSessions } from "./src/controllers/installedGameController.js";

const API_PORT = process.env.API_PORT || 5001;

const app = express();

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connect();

    // 🧹 Cleanup des sessions bloquées au démarrage
    await cleanupStuckSessions();

    // Créer le dossier logs s'il n'existe pas
    if (!fs.existsSync("logs")) {
      fs.mkdirSync("logs");
    }

    // 🔒 MIDDLEWARES DE SÉCURITÉ (ORDRE IMPORTANT)
    app.use(helmetConfig); // Headers de sécurité
    app.use(corsConfig); // CORS sécurisé
    app.use(express.json({ limit: "10mb" })); // Limite la taille des JSON
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Middleware de logging des requêtes
    app.use((req, res, next) => {
      console.log(
        `${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`
      );
      next();
    });

    // Routes avec préfixes sécurisés
    app.use("/api/server", serverRoute);
    app.use("/api/users", userRoute);
    app.use("/api/serverGame", serverGameRoute);
    app.use("/api/review", reviewRoute);
    app.use("/api/igdb", igdbRoute);
    app.use("/api/installedGames", installedGamesRoute);

    // Route racine
    app.get("/", (req, res) => {
      res.json({
        message: "Drathos API Server",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
      });
    });

    // 🚨 MIDDLEWARES D'ERREUR (À LA FIN)
    app.use(notFoundHandler); // Routes non trouvées
    app.use(errorHandler); // Gestion d'erreurs centralisée

    // Démarrage serveur
    app.listen(API_PORT, () => {
      console.log(`🚀 Serveur Drathos démarré sur le port ${API_PORT}`);
      console.log(`🔒 Sécurité activée : Helmet, CORS, Rate Limiting`);
      console.log(`📁 Logs disponibles dans ./logs/`);
    });

    return app;
  } catch (error) {
    console.error("❌ Erreur au démarrage du serveur:", error);
    process.exit(1);
  }
};

startServer();

export default app;
