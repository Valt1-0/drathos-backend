import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  message: { error: true, message: "Trop de tentatives, réessaie dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 2000 : 500,
  message: { error: true, message: "Trop de requêtes, ralentis." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const downloadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isDev ? 500 : 20,
  message: { error: true, message: "Trop de téléchargements, réessaie dans 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
