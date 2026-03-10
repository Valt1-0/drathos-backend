import express from "express";
import {
  register,
  login,
  getAllUsers,
  getUserProfile,
  updateProfileVisibility,
  uploadProfilePicture,
  deleteProfilePicture,
  uploadMiddleware,
  updateUserRole,
} from "../controllers/userController.js";
import {
  validateRegister,
  validateLogin,
  validateUserId,
  validateRoleUpdate,
} from "../middlewares/validationMiddleware.js";
import { authMiddleware, requireAdminOrModerator } from "../middlewares/authMiddleware.js";
import { authLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.post("/register", authLimiter, validateRegister, register);
router.post("/login", authLimiter, validateLogin, login);

router.get("/profiles", authMiddleware, getAllUsers);
router.get("/profiles/:userId", authMiddleware, validateUserId, getUserProfile);
router.patch("/profile/visibility", authMiddleware, updateProfileVisibility);

router.post(
  "/profile/picture",
  authMiddleware,
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File too large. Maximum size is 5MB." });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  uploadProfilePicture,
);

router.delete("/profile/picture", authMiddleware, deleteProfilePicture);

// ==================== ADMIN ====================
router.patch("/:userId/role", authMiddleware, requireAdminOrModerator, validateRoleUpdate, updateUserRole);

export default router;
