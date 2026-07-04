import "dotenv/config.js";
import logger from "./src/utils/logger.js";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import { connect } from "./src/db/mongoConnect.js";
import mongoose from "mongoose";
import { setIO } from "./src/socket.js";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { apiLimiter } from "./src/middlewares/rateLimitMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  corsConfig,
  helmetConfig,
} from "./src/middlewares/securityMiddleware.js";
import { loadBlacklist } from "./src/middlewares/authMiddleware.js";

import {
  errorHandler,
  notFoundHandler,
} from "./src/middlewares/errorMiddleware.js";

import serverRoute from "./src/routes/serverRoutes.js";
import userRoute from "./src/routes/userRoutes.js";
import serverGameRoute from "./src/routes/serverGameRoutes.js";
import igdbRoute from "./src/routes/igdbRoutes.js";
import installedGamesRoute from "./src/routes/installedGamesRoutes.js";
import collectionRoute from "./src/routes/collectionRoutes.js";
import modRoute from "./src/routes/modRoutes.js";
import gameRequestRoute from "./src/routes/gameRequestRoutes.js";

import { cleanupStuckSessions } from "./src/controllers/installedGameController.js";

const API_PORT = process.env.API_PORT || 5001;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const httpServer = createServer(app);

const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";
const io = new Server(httpServer, {
  cors: {
    origin: rawOrigins === "*" ? "*" : rawOrigins.split(",").map((o) => o.trim()),
    methods: ["GET", "POST"],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN);
    if (!decoded?.user?.id) {
      return next(new Error("Invalid token"));
    }
    socket.user = { id: decoded.user.id, username: decoded.user.username, role: decoded.user.role };
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

setIO(io);

io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id} (user: ${socket.user?.username})`);
  socket.on("disconnect", () => logger.info(`Client disconnected: ${socket.id}`));
});

const startServer = async () => {
  try {
    await connect();

    await loadBlacklist();

    await cleanupStuckSessions().catch((err) =>
      logger.error("[startup] cleanupStuckSessions failed:", err)
    );

    const logsDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Only profile pictures are public — game/mod archives live under serverData
    // too and must never be reachable without auth (they are streamed through
    // the authenticated /api download routes instead).
    app.use("/serverData/users", (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Cache-Control", "public, max-age=3600");
      next();
    }, express.static(path.join(__dirname, "serverData/users")));

    app.use(helmetConfig);
    app.use(corsConfig);
    app.use(compression());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    app.use((req, res, next) => {
      req.id = randomUUID();
      res.setHeader("X-Request-Id", req.id);
      next();
    });

    app.use("/api/", apiLimiter);

    app.use((req, res, next) => {
      logger.info(`[${req.id}] ${req.method} ${req.url} - IP: ${req.ip}`);
      next();
    });

    app.use("/api/server", serverRoute);
    app.use("/api/users", userRoute);
    app.use("/api/serverGame", serverGameRoute);
    app.use("/api/igdb", igdbRoute);
    app.use("/api/installedGames", installedGamesRoute);
    app.use("/api/collections", collectionRoute);
    app.use("/api/mods", modRoute);
    app.use("/api/requests", gameRequestRoute);

    app.get("/", (req, res) => {
      res.json({
        message: "Drathos API Server",
        version: "1.0.1",
        status: "running",
        timestamp: new Date().toISOString(),
      });
    });

    app.use(notFoundHandler);
    app.use(errorHandler);

    httpServer.listen(API_PORT, () => {
      logger.info(`Drathos server started on port ${API_PORT}`);
      logger.info(`Socket.IO enabled`);
      logger.info(`Security enabled: Helmet, CORS, Rate Limiting`);
      logger.info(`Logs available in ./logs/`);
    });

    setInterval(async () => {
      try {
        if (mongoose.connection.readyState !== 1) {
          logger.error(`[healthcheck] MongoDB not connected (state: ${mongoose.connection.readyState})`);
          return;
        }
        await mongoose.connection.db.admin().ping();
      } catch (err) {
        logger.error("[healthcheck] MongoDB ping failed:", err.message);
      }
    }, 30_000).unref();

    return app;
  } catch (error) {
    logger.error("Server startup error:", error);
    process.exit(1);
  }
};

startServer();

const shutdown = async (signal) => {
  logger.info(`\n${signal} received — graceful shutdown...`);
  setTimeout(() => process.exit(1), 10000).unref();
  await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.connection.close();
  logger.info("MongoDB connection closed.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
