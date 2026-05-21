import helmet from "helmet";
import cors from "cors";

const getAllowedOrigins = () => {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";

  if (corsOrigins === "*") {
    return "*";
  }

  return corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const corsConfig = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    const strictMode = process.env.CORS_STRICT_MODE === "true";

    if (allowedOrigins === "*") {
      return callback(null, true);
    }

    if (!origin) {
      return callback(null, true);
    }

    if (
      origin === "null" ||
      origin.startsWith("file://") ||
      origin.startsWith("app://")
    ) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== "production") {
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("192.168.") ||
        origin.includes(".local") ||
        origin.includes(".home.arpa")
      ) {
        return callback(null, true);
      }
    }

    if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (strictMode) {
      return callback(new Error("Not allowed by CORS"));
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "X-Requested-With",
  ],
  exposedHeaders: ["Content-Length", "Content-Type"],
});

export const helmetConfig = helmet({
  contentSecurityPolicy:
    process.env.NODE_ENV === "production"
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
          },
        }
      : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
