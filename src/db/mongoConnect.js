import logger from "../utils/logger.js";
import mongoose from "mongoose";
mongoose.set("strictQuery", false);
import "dotenv/config.js";

const { MONGODB_URI } = process.env;

const LEGACY_INDEXES_TO_DROP = [
  { collection: "servergames", index: "igdbId_1" },
];

const cleanupLegacyIndexes = async () => {
  for (const { collection, index } of LEGACY_INDEXES_TO_DROP) {
    try {
      await mongoose.connection.collection(collection).dropIndex(index);
      logger.info(`[DB] Dropped legacy index: ${collection}.${index}`);
    } catch {
      // Index already gone or never existed — that's fine
    }
  }
};

export const connect = async () => {
  await mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      logger.info(
        "Successfully connected to database " + mongoose.connection.name
      );
      await cleanupLegacyIndexes();
    })
    .catch((error) => {
      logger.error("database connection failed. exiting now...");
      logger.error(error);
      process.exit(1);
    });
};
