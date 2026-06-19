import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      error: true,
      message: "Validation error",
      details: errors,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      error: true,
      message: `${field} already exists`,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: true,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: true,
      message: "Token expired",
    });
  }

  if (err.code === "ENOENT") {
    return res.status(404).json({
      error: true,
      message: "File not found",
    });
  }

  const statusCode = err.statusCode || 500;
  // Mask internal details for 5xx in production — message may contain sensitive info
  const message =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message;

  // Stack is already logged above — never expose it in HTTP responses
  res.status(statusCode).json({
    error: true,
    message,
  });
};

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
