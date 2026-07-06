import { Router } from "express";
import {
  getDashboardStats,
  getUsers,
  getUserById,
  createUser,
  updateUserStatus,
  deleteUser,
  getPendingGyms,
  updateGymStatus,
  getPendingTrainers,
  verifyTrainer,
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
router.patch("/gyms/:id/status", updateGymStatus);

router.get("/trainers/pending", getPendingTrainers);
router.patch("/trainers/:id/verify", verifyTrainer);

export default router;
