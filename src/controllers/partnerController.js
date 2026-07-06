import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import SupplementProduct from "../models/SupplementProduct.js";
import Order from "../models/Order.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { GYM_STATUS, ROLES } from "../utils/constants.js";

const partnerRoles = [
  ROLES.GYM_OWNER,
  ROLES.TRAINER,
  ROLES.SUPPLEMENT_PROVIDER,
];

const assertPartnerRole = (user, allowedRoles = partnerRoles) => {
  if (!allowedRoles.includes(user.role)) {
    throw new AppError("Partner access required", 403);
  }
};

export const getDashboard = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user);

  const base = {
    user: req.user.toPublicJSON(),
    onboardingComplete: false,
    stats: {},
  };

  if (req.user.role === ROLES.GYM_OWNER) {
    const gym = await Gym.findOne({ ownerId: req.user._id });
    base.onboardingComplete = Boolean(gym);
    base.gym = gym;
    base.stats = {
      plans: gym?.plans?.filter((p) => p.isActive).length || 0,
      status: gym?.status || "NOT_CREATED",
    };
  }

  if (req.user.role === ROLES.TRAINER) {
    const profile = await TrainerProfile.findOne({ userId: req.user._id });
    base.onboardingComplete = Boolean(profile);
    base.trainerProfile = profile;
    base.stats = {
      clients: profile?.assignedCustomers?.length || 0,
      verified: profile?.isVerified || false,
    };
  }

  if (req.user.role === ROLES.SUPPLEMENT_PROVIDER) {
    const products = await SupplementProduct.find({ sellerId: req.user._id });
    const orders = await Order.countDocuments({ sellerId: req.user._id });
    base.onboardingComplete = products.length > 0;
    base.stats = {
      products: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      approvedProducts: products.filter((p) => p.isApproved).length,
      orders,
    };
  }

  res.json({ success: true, data: base });
});

export const getGym = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });

  res.json({
    success: true,
    data: { gym },
  });
});

export const createGym = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const existing = await Gym.findOne({ ownerId: req.user._id });
  if (existing) {
    throw new AppError("You already have a gym profile", 409);
  }

  const { name, description, location, facilities, timing } = req.body;

  if (!name?.trim()) {
    throw new AppError("Gym name is required", 400);
  }

  const gym = await Gym.create({
    ownerId: req.user._id,
    name: name.trim(),
    description: description?.trim() || "",
    location: location || {},
    facilities: facilities || [],
    timing: timing || [],
    status: GYM_STATUS.PENDING,
  });

  res.status(201).json({
    success: true,
    message: "Gym profile created. Awaiting admin approval.",
    data: { gym },
  });
});

export const updateGym = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });
  if (!gym) {
    throw new AppError("Gym profile not found. Create one first.", 404);
  }

  const { name, description, location, facilities, timing, images } = req.body;

  if (name !== undefined) gym.name = name.trim();
  if (description !== undefined) gym.description = description;
  if (location !== undefined) gym.location = { ...gym.location, ...location };
  if (facilities !== undefined) gym.facilities = facilities;
  if (timing !== undefined) gym.timing = timing;
  if (images !== undefined) gym.images = images;

  await gym.save();

  res.json({
    success: true,
    message: "Gym profile updated",
    data: { gym },
  });
});

export const addGymPlan = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });
  if (!gym) {
    throw new AppError("Gym profile not found", 404);
  }

  const { name, description, durationDays, price, features } = req.body;

  if (!name?.trim() || !durationDays || price === undefined) {
    throw new AppError("Plan name, duration, and price are required", 400);
  }

  gym.plans.push({
    name: name.trim(),
    description: description || "",
    durationDays: Number(durationDays),
    price: Number(price),
    features: features || [],
    isActive: true,
  });

  await gym.save();

  res.status(201).json({
    success: true,
    message: "Membership plan added",
    data: { gym },
  });
});

export const updateGymPlan = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });
  if (!gym) {
    throw new AppError("Gym profile not found", 404);
  }

  const plan = gym.plans.id(req.params.planId);
  if (!plan) {
    throw new AppError("Plan not found", 404);
  }

  const { name, description, durationDays, price, features, isActive } = req.body;

  if (name !== undefined) plan.name = name.trim();
  if (description !== undefined) plan.description = description;
  if (durationDays !== undefined) plan.durationDays = Number(durationDays);
  if (price !== undefined) plan.price = Number(price);
  if (features !== undefined) plan.features = features;
  if (isActive !== undefined) plan.isActive = isActive;

  await gym.save();

  res.json({
    success: true,
    message: "Plan updated",
    data: { gym },
  });
});

export const deleteGymPlan = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });
  if (!gym) {
    throw new AppError("Gym profile not found", 404);
  }

  const plan = gym.plans.id(req.params.planId);
  if (!plan) {
    throw new AppError("Plan not found", 404);
  }

  plan.deleteOne();
  await gym.save();

  res.json({
    success: true,
    message: "Plan removed",
    data: { gym },
  });
});

export const getTrainerProfile = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await TrainerProfile.findOne({ userId: req.user._id }).populate(
    "gymId",
    "name status"
  );

  res.json({
    success: true,
    data: { profile },
  });
});

export const createTrainerProfile = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const existing = await TrainerProfile.findOne({ userId: req.user._id });
  if (existing) {
    throw new AppError("Trainer profile already exists", 409);
  }

  const { bio, experience, skills, specializations, hourlyRate, gymId } =
    req.body;

  const profile = await TrainerProfile.create({
    userId: req.user._id,
    bio: bio?.trim() || "",
    experience: Number(experience) || 0,
    skills: skills || [],
    specializations: specializations || [],
    hourlyRate: Number(hourlyRate) || 0,
    gymId: gymId || undefined,
    isVerified: false,
  });

  res.status(201).json({
    success: true,
    message: "Trainer profile created. Awaiting admin verification.",
    data: { profile },
  });
});

export const updateTrainerProfile = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await TrainerProfile.findOne({ userId: req.user._id });
  if (!profile) {
    throw new AppError("Trainer profile not found. Create one first.", 404);
  }

  const { bio, experience, skills, specializations, hourlyRate, gymId } =
    req.body;

  if (bio !== undefined) profile.bio = bio;
  if (experience !== undefined) profile.experience = Number(experience);
  if (skills !== undefined) profile.skills = skills;
  if (specializations !== undefined) profile.specializations = specializations;
  if (hourlyRate !== undefined) profile.hourlyRate = Number(hourlyRate);
  if (gymId !== undefined) profile.gymId = gymId || undefined;

  await profile.save();

  res.json({
    success: true,
    message: "Trainer profile updated",
    data: { profile },
  });
});

export const getProducts = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const products = await SupplementProduct.find({ sellerId: req.user._id }).sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    data: { products },
  });
});

export const createProduct = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const { name, description, category, brand, price, discountPrice, stock } =
    req.body;

  if (!name?.trim() || price === undefined) {
    throw new AppError("Product name and price are required", 400);
  }

  const product = await SupplementProduct.create({
    sellerId: req.user._id,
    name: name.trim(),
    description: description?.trim() || "",
    category: category?.trim() || "",
    brand: brand?.trim() || "",
    price: Number(price),
    discountPrice: discountPrice ? Number(discountPrice) : undefined,
    stock: Number(stock) || 0,
    isApproved: false,
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: "Product created. Awaiting admin approval.",
    data: { product },
  });
});

export const updateProduct = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const product = await SupplementProduct.findOne({
    _id: req.params.id,
    sellerId: req.user._id,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const {
    name,
    description,
    category,
    brand,
    price,
    discountPrice,
    stock,
    isActive,
  } = req.body;

  if (name !== undefined) product.name = name.trim();
  if (description !== undefined) product.description = description;
  if (category !== undefined) product.category = category;
  if (brand !== undefined) product.brand = brand;
  if (price !== undefined) product.price = Number(price);
  if (discountPrice !== undefined) {
    product.discountPrice = discountPrice ? Number(discountPrice) : undefined;
  }
  if (stock !== undefined) product.stock = Number(stock);
  if (isActive !== undefined) product.isActive = isActive;

  await product.save();

  res.json({
    success: true,
    message: "Product updated",
    data: { product },
  });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const product = await SupplementProduct.findOneAndDelete({
    _id: req.params.id,
    sellerId: req.user._id,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  res.json({
    success: true,
    message: "Product deleted",
  });
});
