export const ROLES = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  MEMBER: "member",
};

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// 4h is a reasonable balance for a self-hosted gaming library:
// long enough that users aren't interrupted mid-session, short enough
// to limit the exposure window of a stolen token.
export const JWT_EXPIRES_IN = "4h";
export const REFRESH_TOKEN_EXPIRES_IN = "7d";
export const MAX_PROFILE_PIC_SIZE = 5 * 1024 * 1024; // 5 MB
