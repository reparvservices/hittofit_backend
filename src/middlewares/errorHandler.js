import multer from "multer";
import { AppError } from "../utils/AppError.js";

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(", ") || message;
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Image is too large. Max size is 5MB.";
    } else if (err.code === "LIMIT_FILE_COUNT") {
      message = "Too many images. Max is 8 per upload.";
    } else {
      message = err.message;
    }
  } else if (message.includes("Only image files are allowed")) {
    statusCode = 400;
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && err.stack
      ? { stack: err.stack }
      : {}),
  });
};

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export default errorHandler;
