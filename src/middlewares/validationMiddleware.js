import { body, param, validationResult } from "express-validator";
import { ROLES, PASSWORD_REGEX, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "../utils/constants.js";

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: "Invalid data",
      details: errors.array(),
    });
  }
  next();
};

export const validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Username can only contain letters, digits, _ and -"),

  body("password")
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
    .matches(PASSWORD_REGEX)
    .withMessage("Password must contain at least one lowercase letter, one uppercase letter, one digit and one special character (@$!%*?&)"),

  handleValidationErrors,
];

export const validateLogin = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ max: 30 })
    .withMessage("Username too long"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ max: 128 })
    .withMessage("Password too long"),

  handleValidationErrors,
];

export const validateAddGame = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("version")
    .optional()
    .trim()
    .matches(/^\d+\.\d+\.\d+$/)
    .withMessage("Version must be in x.y.z format"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic must be a boolean"),

  body("multiplayer.enabled")
    .optional()
    .isBoolean()
    .withMessage("multiplayer.enabled must be a boolean"),

  body("multiplayer.type")
    .optional()
    .isIn(['online', 'local', 'both', null, ''])
    .withMessage("multiplayer.type must be 'online', 'local' or 'both'"),

  body("multiplayer.maxPlayers")
    .optional()
    .custom((value) => value === null || value === '' || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999))
    .withMessage("multiplayer.maxPlayers must be a number between 1 and 999"),

  body("multiplayer.modes")
    .optional()
    .custom((value) => {
      if (!value) return true;
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          return false;
        }
      }
      return Array.isArray(value) && value.every(mode => ['co-op', 'pvp'].includes(mode));
    })
    .withMessage("multiplayer.modes must be an array containing 'co-op' and/or 'pvp'"),

  handleValidationErrors,
];

export const validateUpdateGame = [
  param("id").isMongoId().withMessage("Invalid game ID"),

  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  handleValidationErrors,
];

export const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid ID"),
  handleValidationErrors,
];

export const validateUserId = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  handleValidationErrors,
];

export const validateRoleUpdate = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isIn(Object.values(ROLES))
    .withMessage(`Invalid role. Must be one of: ${Object.values(ROLES).join(", ")}`),
  handleValidationErrors,
];
