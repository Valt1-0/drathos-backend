import "dotenv/config.js";
import express from "express";
import { connect } from "./src/db/mongoConnect.js";

import cors from "cors";
import bodyParser from "body-parser";
import path from "path";

import serverRoute from "./src/routes/serverRoutes.js";
import userRoute from "./src/routes/userRoutes.js";
import serverGameRoute from "./src/routes/serverGameRoutes.js";
import reviewRoute from "./src/routes/reviewRoutes.js";
import igdbRoute from "./src/routes/igdbRoutes.js";
import installedGamesRoute from "./src/routes/installedGamesRoutes.js";

const API_PORT =
  process.env.API_PORT || console.log("No port defined in .env file");

const app = express();

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connect();

    app.use(cors());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json({ type: "application/json" }));

    // Routes
    app.use("/api/server", serverRoute);
    app.use("/api/users", userRoute);
    app.use("/api/serverGame", serverGameRoute);
    app.use("/api/review", reviewRoute);
    app.use("/api/igdb", igdbRoute);
    app.use("/api/installedGames", installedGamesRoute);

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // Server listening
    app.listen(API_PORT, () => {
      console.log(`Server running on port ${API_PORT}`);
    });

    return app;
  } catch (error) {
    console.log(error);
  }
};

startServer();

export default app;
