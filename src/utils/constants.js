export const ROLES = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  MEMBER: "member",
};

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const JWT_EXPIRES_IN = "30d";
export const MAX_PROFILE_PIC_SIZE = 5 * 1024 * 1024; // 5 MB
