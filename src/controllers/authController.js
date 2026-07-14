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
  const {
    name,
    phone,
    profileImage,
    bio,
    wellnessPreferences,
    fitnessGoals,
    notificationSettings,
  } = req.body;

  if (name !== undefined) req.user.name = String(name).trim();
  if (phone !== undefined) req.user.phone = String(phone).trim();
  if (profileImage !== undefined) req.user.profileImage = profileImage;
  if (bio !== undefined) req.user.bio = String(bio).trim().slice(0, 280);
  if (Array.isArray(wellnessPreferences)) {
    req.user.wellnessPreferences = wellnessPreferences
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (Array.isArray(fitnessGoals)) {
    req.user.fitnessGoals = fitnessGoals
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (notificationSettings && typeof notificationSettings === "object") {
    req.user.notificationSettings = {
      workoutReminders:
        notificationSettings.workoutReminders !== undefined
          ? Boolean(notificationSettings.workoutReminders)
          : req.user.notificationSettings?.workoutReminders !== false,
    };
  }

  await req.user.save();

  res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: req.user.toPublicJSON(),
    },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (String(newPassword).length < 6) {
    throw new AppError("New password must be at least 6 characters", 400);
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  res.json({
    success: true,
    message: "Password updated successfully",
    data: {
      user: user.toPublicJSON(),
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
  user.passwordChangedAt = new Date();
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: "Password reset successful",
  });
});
