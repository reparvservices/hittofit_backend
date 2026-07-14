import { Router } from "express";
import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import partnerRoutes from "./partnerRoutes.js";
import publicRoutes from "./publicRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import customerRoutes from "./customerRoutes.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ success: true, message: "Hittofit API is running" });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/partner", partnerRoutes);
router.use("/customer", customerRoutes);
router.use("/public", publicRoutes);
router.use("/uploads", uploadRoutes);

export default router;
