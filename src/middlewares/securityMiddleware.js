import helmet from "helmet";
import cors from "cors";

// Récupérer les origines autorisées depuis .env
const getAllowedOrigins = () => {
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS || "*";

  // Si "*", tout autoriser
  if (corsOrigins === "*") {
    return "*";
  }

  // Sinon, parser la liste d'origines séparées par virgule
  return corsOrigins.split(",").map(origin => origin.trim()).filter(Boolean);
};

// Configuration CORS sécurisée et configurable
export const corsConfig = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    const strictMode = process.env.CORS_STRICT_MODE === "true";

    // Si CORS_ALLOWED_ORIGINS est "*", tout autoriser
    if (allowedOrigins === "*") {
      return callback(null, true);
    }

    // Toujours autoriser les requêtes sans origin (applications natives, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // En mode non-strict, autoriser automatiquement Electron et apps natives
    if (!strictMode) {
      if (origin === 'null' ||
          origin.startsWith('file://') ||
          origin.startsWith('app://')) {
        return callback(null, true);
      }
    }

    // Autoriser localhost sur tous les ports en développement
    if (process.env.NODE_ENV !== "production") {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Vérifier si l'origin est dans la liste des origines autorisées
    if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // En mode strict, bloquer les origines non autorisées
    if (strictMode) {
      return callback(new Error('Not allowed by CORS'));
    }

    // En mode non-strict, autoriser par défaut
    callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "X-Requested-With"],
  exposedHeaders: ["Content-Length", "Content-Type"],
});

// Configuration Helmet pour sécuriser les headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Pour Electron
});