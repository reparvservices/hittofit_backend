import { Router } from "express";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import partnerRoutes from "./partnerRoutes.js";
import publicRoutes from "./publicRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ success: true, message: "Hittofit API is running" });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/partner", partnerRoutes);
router.use("/public", publicRoutes);

export default router;
