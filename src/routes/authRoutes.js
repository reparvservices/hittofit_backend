import { Router } from "express";
import {
  register,
  login,
  checkUser,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import {
  registerValidation,
  loginValidation,
  checkUserValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
} from "../middlewares/validators/authValidators.js";
import validateRequest from "../middlewares/validateRequest.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/check-user", checkUserValidation, validateRequest, checkUser);
router.post("/register", registerValidation, validateRequest, register);
router.post("/login", loginValidation, validateRequest, login);
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validateRequest,
  forgotPassword
);
router.post(
  "/reset-password",
  resetPasswordValidation,
  validateRequest,
  resetPassword
);

router.get("/me", authMiddleware, getMe);
router.put(
  "/profile",
  authMiddleware,
  updateProfileValidation,
  validateRequest,
  updateProfile
);

export default router;
