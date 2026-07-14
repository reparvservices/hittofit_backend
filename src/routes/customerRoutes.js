import { Router } from "express";
import {
  getDashboard,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  getMemberships,
  createMembership,
  getOrders,
  getOrderById,
  createOrder,
  getPayments,
  getActivity,
} from "../controllers/customerController.js";
import { authMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

router.use(authMiddleware, roleMiddleware([ROLES.CUSTOMER]));

router.get("/dashboard", getDashboard);

router.get("/wishlist", getWishlist);
router.post("/wishlist", addWishlistItem);
router.delete("/wishlist/:itemId", removeWishlistItem);

router.get("/memberships", getMemberships);
router.post("/memberships", createMembership);

router.get("/orders", getOrders);
router.get("/orders/:id", getOrderById);
router.post("/orders", createOrder);

router.get("/payments", getPayments);
router.get("/activity", getActivity);

export default router;
