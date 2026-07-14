import { Router } from "express";
import {
  getDashboardStats,
  getUsers,
  getUserById,
  createUser,
  updateUserStatus,
  deleteUser,
  getPendingGyms,
  getGymById,
  updateGymStatus,
  getPendingTrainers,
  verifyTrainer,
  getPendingProducts,
  updateProductApproval,
  getPendingServices,
  updateServiceApproval,
} from "../controllers/adminController.js";
import { authMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import {
  updateUserStatusValidation,
  createUserValidation,
} from "../middlewares/validators/authValidators.js";
import validateRequest from "../middlewares/validateRequest.js";
import { ROLES } from "../utils/constants.js";

const router = Router();

router.use(authMiddleware, roleMiddleware([ROLES.ADMIN]));

router.get("/dashboard", getDashboardStats);
router.get("/users", getUsers);
router.post("/users", createUserValidation, validateRequest, createUser);
router.get("/users/:id", getUserById);
router.patch(
  "/users/:id/status",
  updateUserStatusValidation,
  validateRequest,
  updateUserStatus
);
router.delete("/users/:id", deleteUser);

router.get("/gyms/pending", getPendingGyms);
router.get("/gyms/:id", getGymById);
router.patch("/gyms/:id/status", updateGymStatus);

router.get("/trainers/pending", getPendingTrainers);
router.patch("/trainers/:id/verify", verifyTrainer);

router.get("/products/pending", getPendingProducts);
router.patch("/products/:id/approval", updateProductApproval);

router.get("/services/pending", getPendingServices);
router.patch("/services/:id/approval", updateServiceApproval);

export default router;
