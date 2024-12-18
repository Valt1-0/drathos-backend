require("./src/db/mongoConnect").connect();
const express = require("express");
require("dotenv").config();
const serverRoute = require("./src/routes/serverRoutes");
const userRoute = require("./src/routes/userRoutes");

const API_PORT =
  process.env.API_PORT || console.log("No port defined in .env file");

const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();

const startServer = async () => {
  try {
    app.use(cors());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json({ type: "application/json" }));

    // Routes

    app.use("/api/server", serverRoute);
    app.use("/api/users", userRoute);
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

module.exports = startServer;
