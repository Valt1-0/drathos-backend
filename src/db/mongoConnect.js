import logger from "../utils/logger.js";
import mongoose from "mongoose";
mongoose.set("strictQuery", false);
import "dotenv/config.js";

const { MONGODB_URI } = process.env;

export const connect = async () => {
  await mongoose
    .connect(MONGODB_URI)
    .then(() => {
      logger.info(
        "Successfully connected to database " + mongoose.connection.name
      );
    })
    .catch((error) => {
      logger.error("database connection failed. exiting now...");
      logger.error(error);
      process.exit(1);
    });
};
