import asyncHandler from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { buildPublicUrl } from "../middlewares/uploadMiddleware.js";

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);

  if (!files.length) {
    throw new AppError("No image files uploaded", 400);
  }

  const folder = req.uploadFolder || "general";
  const urls = files.map((file) => buildPublicUrl(req, folder, file.filename));

  res.status(201).json({
    success: true,
    message: files.length === 1 ? "Image uploaded" : "Images uploaded",
    data: {
      urls,
      url: urls[0],
    },
  });
});
