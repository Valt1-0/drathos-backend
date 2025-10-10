import express from "express";
const router = express.Router();
import {
  getServerStatus,
  getServerHealth,
} from "../controllers/serverController.js";

// Health check rapide (sans auth)
router.get("/health", getServerHealth);

// Status détaillé
router.get("/status", getServerStatus);

export default router;