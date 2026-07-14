import User from "../models/User.js";
import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import TrainerService from "../models/TrainerService.js";
import SupplementProduct from "../models/SupplementProduct.js";
import Payment from "../models/Payment.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ROLES, USER_STATUS, PAYMENT_STATUS } from "../utils/constants.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalCustomers,
    totalGymOwners,
    totalTrainers,
    totalSupplementProviders,
    totalGyms,
    pendingGyms,
    pendingPartners,
    pendingProducts,
    pendingServices,
    revenueResult,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.CUSTOMER }),
    User.countDocuments({ role: ROLES.GYM_OWNER }),
    User.countDocuments({ role: ROLES.TRAINER }),
    User.countDocuments({ role: ROLES.SUPPLEMENT_PROVIDER }),
    Gym.countDocuments(),
    Gym.countDocuments({ status: "PENDING" }),
    User.countDocuments({
      role: { $in: [ROLES.GYM_OWNER, ROLES.TRAINER, ROLES.SUPPLEMENT_PROVIDER] },
      status: USER_STATUS.PENDING,
    }),
    SupplementProduct.countDocuments({
      $or: [{ approvalStatus: "PENDING" }, { approvalStatus: { $exists: false }, isApproved: false }],
    }),
    TrainerService.countDocuments({
      $or: [{ approvalStatus: "PENDING" }, { approvalStatus: { $exists: false }, isApproved: false }],
    }),
    Payment.aggregate([
      { $match: { status: PAYMENT_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalCustomers,
      totalGymOwners,
      totalTrainers,
      totalSupplementProviders,
      totalGyms,
      pendingGyms,
      pendingPartners,
      pendingProducts,
      pendingServices,
      totalRevenue: revenueResult[0]?.total || 0,
    },
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { role, roles, status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (roles) {
    const roleList = String(roles)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (roleList.length) filter.role = { $in: roleList };
  } else if (role) {
    filter.role = role;
  }
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      users: users.map((user) => user.toPublicJSON()),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.json({
    success: true,
    data: { user: user.toPublicJSON() },
  });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = Object.values(USER_STATUS);

  if (!allowedStatuses.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === ROLES.ADMIN) {
    throw new AppError("Cannot modify admin account status", 403);
  }

  user.status = status;
  await user.save();

  res.json({
    success: true,
    message: `User status updated to ${status}`,
    data: { user: user.toPublicJSON() },
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === ROLES.ADMIN) {
    throw new AppError("Cannot delete admin account", 403);
  }

  await user.deleteOne();

  res.json({
    success: true,
    message: "User deleted successfully",
  });
});

const partnerRoles = [
  ROLES.GYM_OWNER,
  ROLES.TRAINER,
  ROLES.SUPPLEMENT_PROVIDER,
];

export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, name, email, phone, password, role, status } =
    req.body;

  const fullName =
    name?.trim() ||
    [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");

  if (!fullName) {
    throw new AppError("Name is required", 400);
  }

  if (!email?.trim()) {
    throw new AppError("Email is required", 400);
  }

  if (!phone?.trim()) {
    throw new AppError("Phone number is required", 400);
  }

  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const assignedRole = role || ROLES.CUSTOMER;
  const allowedRoles = Object.values(ROLES);

  if (!allowedRoles.includes(assignedRole)) {
    throw new AppError("Invalid role", 400);
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

  let assignedStatus = status;
  if (!assignedStatus) {
    if (assignedRole === ROLES.CUSTOMER || assignedRole === ROLES.ADMIN) {
      assignedStatus = USER_STATUS.ACTIVE;
    } else if (partnerRoles.includes(assignedRole)) {
      assignedStatus = USER_STATUS.PENDING;
    } else {
      assignedStatus = USER_STATUS.ACTIVE;
    }
  }

  const user = await User.create({
    name: fullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    password,
    role: assignedRole,
    status: assignedStatus,
  });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: { user: user.toPublicJSON() },
  });
});

export const getPendingGyms = asyncHandler(async (req, res) => {
  const gyms = await Gym.find({ status: "PENDING" })
    .populate("ownerId", "name email phone")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { gyms },
  });
});

export const getGymById = asyncHandler(async (req, res) => {
  const gym = await Gym.findById(req.params.id).populate(
    "ownerId",
    "name email phone status"
  );

  if (!gym) {
    throw new AppError("Gym not found", 404);
  }

  res.json({
    success: true,
    data: { gym },
  });
});

export const updateGymStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["APPROVED", "REJECTED", "SUSPENDED", "PENDING"];

  if (!allowed.includes(status)) {
    throw new AppError("Invalid gym status", 400);
  }

  const gym = await Gym.findById(req.params.id);

  if (!gym) {
    throw new AppError("Gym not found", 404);
  }

  gym.status = status;
  await gym.save();
  await gym.populate("ownerId", "name email phone status");

  if (gym.ownerId) {
    if (status === "APPROVED" && gym.ownerId.status === USER_STATUS.PENDING) {
      gym.ownerId.status = USER_STATUS.ACTIVE;
      await gym.ownerId.save();
    }
    if (status === "REJECTED" && gym.ownerId.status === USER_STATUS.PENDING) {
      gym.ownerId.status = USER_STATUS.REJECTED;
      await gym.ownerId.save();
    }
  }

  res.json({
    success: true,
    message: `Gym status updated to ${status}`,
    data: { gym },
  });
});

export const getPendingTrainers = asyncHandler(async (req, res) => {
  const trainers = await TrainerProfile.find({ isVerified: false })
    .populate("userId", "name email phone status")
    .populate("gymId", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { trainers },
  });
});

export const verifyTrainer = asyncHandler(async (req, res) => {
  const { isVerified } = req.body;

  const trainer = await TrainerProfile.findByIdAndUpdate(
    req.params.id,
    { isVerified: Boolean(isVerified) },
    { new: true }
  )
    .populate("userId", "name email phone")
    .populate("gymId", "name");

  if (!trainer) {
    throw new AppError("Trainer profile not found", 404);
  }

  if (isVerified && trainer.userId?.status === USER_STATUS.PENDING) {
    await User.findByIdAndUpdate(trainer.userId._id, {
      status: USER_STATUS.ACTIVE,
    });
  }

  res.json({
    success: true,
    message: isVerified ? "Trainer verified" : "Trainer verification revoked",
    data: { trainer },
  });
});

export const getPendingProducts = asyncHandler(async (req, res) => {
  const products = await SupplementProduct.find({
    $or: [
      { approvalStatus: "PENDING" },
      { approvalStatus: { $exists: false }, isApproved: false },
    ],
  })
    .populate("sellerId", "name email phone role status")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { products },
  });
});

export const updateProductApproval = asyncHandler(async (req, res) => {
  const { isApproved, rejectionReason } = req.body;
  const approved = Boolean(isApproved);

  const product = await SupplementProduct.findById(req.params.id).populate(
    "sellerId",
    "name email phone role status"
  );

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  product.isApproved = approved;
  product.approvalStatus = approved ? "APPROVED" : "REJECTED";
  product.rejectionReason = approved
    ? ""
    : (rejectionReason || "").trim() || "Rejected by admin. Please update and resubmit.";

  await product.save();

  if (approved && product.sellerId?.status === USER_STATUS.PENDING) {
    await User.findByIdAndUpdate(product.sellerId._id, {
      status: USER_STATUS.ACTIVE,
    });
  }

  res.json({
    success: true,
    message: approved ? "Product approved" : "Product rejected",
    data: { product },
  });
});

export const getPendingServices = asyncHandler(async (req, res) => {
  const services = await TrainerService.find({
    $or: [
      { approvalStatus: "PENDING" },
      { approvalStatus: { $exists: false }, isApproved: false },
    ],
  })
    .populate("userId", "name email phone status")
    .populate({
      path: "trainerId",
      select: "bio skills specializations isVerified",
    })
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { services },
  });
});

export const updateServiceApproval = asyncHandler(async (req, res) => {
  const { isApproved, rejectionReason } = req.body;
  const approved = Boolean(isApproved);

  const service = await TrainerService.findById(req.params.id)
    .populate("userId", "name email phone status")
    .populate("trainerId", "bio skills isVerified");

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  service.isApproved = approved;
  service.approvalStatus = approved ? "APPROVED" : "REJECTED";
  service.rejectionReason = approved
    ? ""
    : (rejectionReason || "").trim() || "Rejected by admin. Please update and resubmit.";

  await service.save();

  if (approved && service.userId?.status === USER_STATUS.PENDING) {
    await User.findByIdAndUpdate(service.userId._id, {
      status: USER_STATUS.ACTIVE,
    });
  }

  res.json({
    success: true,
    message: approved ? "Service approved" : "Service rejected",
    data: { service },
  });
});
