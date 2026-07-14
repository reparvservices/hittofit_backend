import { Router } from "express";
import { uploadImages } from "../controllers/uploadController.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

router.post("/", upload.array("images", 8), uploadImages);
router.post("/single", upload.single("image"), uploadImages);

export default router;
