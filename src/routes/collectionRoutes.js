import express from "express";
import {
  createCollection,
  getUserCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  addGamesToCollection,
  removeGamesFromCollection
} from "../controllers/collectionController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/create", createCollection);
router.get("/user", getUserCollections);
router.get("/:id", getCollectionById);
router.patch("/:id/update", updateCollection);
router.delete("/:id/delete", deleteCollection);

router.post("/:id/games/add", addGamesToCollection);
router.delete("/:id/games/remove", removeGamesFromCollection);

export default router;
