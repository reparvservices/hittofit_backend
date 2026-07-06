import { body } from "express-validator";
import { ROLES } from "../../utils/constants.js";

export const registerValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role")
    .optional()
    .isIn([
      ROLES.CUSTOMER,
      ROLES.GYM_OWNER,
      ROLES.TRAINER,
      ROLES.SUPPLEMENT_PROVIDER,
    ])
    .withMessage("Invalid role"),
];

export const loginValidation = [
  body("identifier")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Phone or email is required"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").optional().trim().notEmpty().withMessage("Phone cannot be empty"),
  body("password").notEmpty().withMessage("Password is required"),
  body().custom((_, { req }) => {
    if (!req.body.identifier && !req.body.email && !req.body.phone) {
      throw new Error("Phone or email is required");
    }
    return true;
  }),
];

export const checkUserValidation = [
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").optional().trim().notEmpty().withMessage("Phone cannot be empty"),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Email or phone is required");
    }
    return true;
  }),
];

export const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
];

export const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const updateProfileValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("phone").optional().trim(),
  body("profileImage").optional().isString(),
];

export const updateUserStatusValidation = [
  body("status")
    .isIn(["PENDING", "ACTIVE", "BLOCKED", "REJECTED"])
    .withMessage("Invalid status"),
];

export const createUserValidation = [
  body("firstName").optional().trim().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone").trim().notEmpty().withMessage("Phone number is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role")
    .isIn(Object.values(ROLES))
    .withMessage("Invalid role"),
  body("status")
    .optional()
    .isIn(["PENDING", "ACTIVE", "BLOCKED", "REJECTED"])
    .withMessage("Invalid status"),
  body().custom((_, { req }) => {
    const hasName = req.body.name?.trim();
    const hasFirstLast =
      req.body.firstName?.trim() && req.body.lastName?.trim();
    if (!hasName && !hasFirstLast) {
      throw new Error("First name and last name are required");
    }
    return true;
  }),
];
