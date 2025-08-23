import helmet from "helmet";
import cors from "cors";

// Configuration CORS sécurisée
export const corsConfig = cors({
  origin:
    process.env.NODE_ENV === "production"
      ? ["http://localhost:3000", "https://yourdomain.com"] // Ajustez selon vos domaines
      : true, // En dev, autorise tout
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
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