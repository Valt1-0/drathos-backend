import express from "express";
const router = express.Router();
import {
  getServerStatus,
  getServerHealth,
  getServerSettings,
  patchServerSettings,
} from "../controllers/serverController.js";
import { authMiddleware, requireAdmin } from "../middlewares/authMiddleware.js";

router.get("/health", getServerHealth);
router.get("/status", getServerStatus);

router.get("/settings", authMiddleware, getServerSettings);
router.patch("/settings", authMiddleware, requireAdmin, patchServerSettings);

export default router;
