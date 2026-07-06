import crypto from "crypto";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import generateToken from "../utils/generateToken.js";
import { parseIdentifier } from "../utils/parseIdentifier.js";
import { ROLES, USER_STATUS } from "../utils/constants.js";

const partnerRoles = [
  ROLES.GYM_OWNER,
  ROLES.TRAINER,
  ROLES.SUPPLEMENT_PROVIDER,
];

export const checkUser = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;

  if (!email && !phone) {
    throw new AppError("Email or phone is required", 400);
  }

  const query = email
    ? { email: email.toLowerCase().trim() }
    : { phone: phone.trim() };

  const user = await User.findOne(query).select("name email phone role status");

  if (user && user.role !== ROLES.CUSTOMER) {
    throw new AppError("Please use the partner or admin portal to sign in", 403);
  }

  res.json({
    success: true,
    data: {
      exists: Boolean(user),
      name: user?.name || null,
    },
  });
});

export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, name, email, phone, password, role } = req.body;

  const fullName =
    name?.trim() ||
    [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");

  if (!fullName) {
    throw new AppError("First name and last name are required", 400);
  }

  if (!phone?.trim()) {
    throw new AppError("Phone number is required", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = phone.trim();

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new AppError("Email is already registered", 409);
  }

  const existingPhone = await User.findOne({ phone: normalizedPhone });
  if (existingPhone) {
    throw new AppError("Phone number is already registered", 409);
  }

  const assignedRole = role || ROLES.CUSTOMER;
  const allowedSelfRegisterRoles = [ROLES.CUSTOMER, ...partnerRoles];

  if (!allowedSelfRegisterRoles.includes(assignedRole)) {
    throw new AppError("Invalid registration role", 400);
  }

  const status =
    assignedRole === ROLES.CUSTOMER ? USER_STATUS.ACTIVE : USER_STATUS.PENDING;

  const user = await User.create({
    name: fullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    password,
    role: assignedRole,
    status,
  });

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    message:
      status === USER_STATUS.PENDING
        ? "Registration successful. Awaiting admin approval."
        : "Registration successful",
    data: {
      user: user.toPublicJSON(),
      token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, email, phone, password } = req.body;

  const loginKey =
    identifier?.trim() ||
    email?.trim() ||
    phone?.trim();

  if (!loginKey) {
    throw new AppError("Phone or email is required", 401);
  }

  const query = parseIdentifier(loginKey);

  const user = await User.findOne(query).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid credentials", 401);
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError("Your account has been blocked", 403);
  }

  if (user.status === USER_STATUS.REJECTED) {
    throw new AppError("Your account registration was rejected", 403);
  }

  const token = generateToken(user);

  res.json({
    success: true,
    message: "Login successful",
    data: {
      user: user.toPublicJSON(),
      token,
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user.toPublicJSON(),
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, profileImage } = req.body;

  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (profileImage !== undefined) req.user.profileImage = profileImage;

  await req.user.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: req.user.toPublicJSON(),
    },
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    return res.json({
      success: true,
      message: "If that email exists, a reset link has been sent",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
  await user.save();

  res.json({
    success: true,
    message: "If that email exists, a reset link has been sent",
    ...(process.env.NODE_ENV !== "production" && {
      data: { resetToken },
    }),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Password reset successful",
  });
});
