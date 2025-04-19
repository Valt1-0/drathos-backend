import express from "express";
const router = express.Router();
import { getServerStatus } from "../controllers/serverController.js";

router.get("/status", getServerStatus);

export default router;