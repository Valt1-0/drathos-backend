import mongoose from "mongoose";
mongoose.set("strictQuery", false);
import "dotenv/config.js";

const { MONGODB_URI } = process.env;

export const connect = async () => {
  await mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log(
        "Successfully connected to database " + mongoose.connection.name
      );
    })
    .catch((error) => {
      console.log("database connection failed. exiting now...");
      console.error(error);
      process.exit(1);
    });
};
