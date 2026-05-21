import express from "express";
import { getAllRequests, createRequest, deleteRequest } from "../controllers/gameRequestController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", getAllRequests);
router.post("/", authLimiter, createRequest);
router.delete("/:id", deleteRequest);

export default router;
