import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, printf, colorize, errors, splat } = winston.format;

const formatExtra = (args) => {
  if (!Array.isArray(args) || args.length === 0) return "";
  return " " + args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object") return JSON.stringify(a);
    return String(a);
  }).join(" ");
};

const logFormat = printf(({ level, message, timestamp, stack, [Symbol.for("splat")]: splatArgs }) => {
  return `${timestamp} [${level}]: ${stack || message}${formatExtra(splatArgs)}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    splat(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), errors({ stack: true }), splat(), logFormat),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
    }),
  ],
});

export default logger;
