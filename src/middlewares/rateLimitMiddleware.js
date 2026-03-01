import rateLimit from "express-rate-limit";

// Selfhost : limites généreuses mais suffisantes pour bloquer les abus
const isDev = process.env.NODE_ENV !== "production";

// Authentification — anti brute-force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isDev ? 100 : 20,
  message: { error: true, message: "Trop de tentatives, réessaie dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// API générale — très généreux pour selfhost (groupe de joueurs)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: isDev ? 2000 : 500,
  message: { error: true, message: "Trop de requêtes, ralentis." },
  standardHeaders: true,
  legacyHeaders: false,
});

