import { body, param, validationResult } from "express-validator";

// Middleware pour gérer les erreurs de validation
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      message: "Données invalides",
      details: errors.array(),
    });
  }
  next();
};

// Validations pour l'authentification
export const validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Le nom d'utilisateur doit contenir entre 3 et 30 caractères")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage(
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, _ et -"
    ),

  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Le mot de passe doit contenir entre 8 et 128 caractères")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&)"
    ),

  handleValidationErrors,
];

export const validateLogin = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Nom d'utilisateur requis")
    .isLength({ max: 30 })
    .withMessage("Nom d'utilisateur trop long"),

  body("password")
    .notEmpty()
    .withMessage("Mot de passe requis")
    .isLength({ max: 128 })
    .withMessage("Mot de passe trop long"),

  handleValidationErrors,
];

// Validations pour les jeux
export const validateAddGame = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Le titre doit contenir entre 1 et 200 caractères"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("La description ne peut pas dépasser 2000 caractères"),

  body("version")
    .optional()
    .trim()
    .matches(/^\d+\.\d+\.\d+$/)
    .withMessage("La version doit être au format x.y.z"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic doit être un booléen"),

  // Nouveau format multiplayer (objet)
  body("multiplayer.enabled")
    .optional()
    .isBoolean()
    .withMessage("multiplayer.enabled doit être un booléen"),

  body("multiplayer.type")
    .optional()
    .isIn(['online', 'local', 'both', null, ''])
    .withMessage("multiplayer.type doit être 'online', 'local' ou 'both'"),

  body("multiplayer.maxPlayers")
    .optional()
    .custom((value) => value === null || value === '' || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999))
    .withMessage("multiplayer.maxPlayers doit être un nombre entre 1 et 999"),

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
    .withMessage("multiplayer.modes doit être un tableau contenant 'co-op' et/ou 'pvp'"),

  handleValidationErrors,
];

export const validateUpdateGame = [
  param("id").isMongoId().withMessage("ID de jeu invalide"),

  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Le titre doit contenir entre 1 et 200 caractères"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("La description ne peut pas dépasser 2000 caractères"),

  handleValidationErrors,
];

// Validation ID MongoDB générique
export const validateObjectId = [
  param("id").isMongoId().withMessage("ID invalide"),
  handleValidationErrors,
];

// Validation userId MongoDB
export const validateUserId = [
  param("userId").isMongoId().withMessage("User ID invalide"),
  handleValidationErrors,
];

// Validation role update
export const validateRoleUpdate = [
  param("userId").isMongoId().withMessage("User ID invalide"),
  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role requis")
    .isIn(["admin", "moderator", "member"])
    .withMessage("Role invalide. Doit être: admin, moderator, ou member"),
  handleValidationErrors,
];
