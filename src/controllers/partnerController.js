import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import TrainerService from "../models/TrainerService.js";
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

const sanitizeGymLocation = (location = {}) => {
  const next = {
    address: location.address || "",
    city: location.city || "",
    state: location.state || "",
    pincode: location.pincode || "",
  };

  const coords = location.coordinates;
  const pair = coords?.coordinates;
  const hasValidCoords =
    Array.isArray(pair) &&
    pair.length === 2 &&
    Number.isFinite(Number(pair[0])) &&
    Number.isFinite(Number(pair[1]));

  if (hasValidCoords) {
    next.coordinates = {
      type: "Point",
      coordinates: [Number(pair[0]), Number(pair[1])],
    };
  }

  return next;
};

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
    const services = profile
      ? await TrainerService.find({ trainerId: profile._id })
      : [];
    base.onboardingComplete = Boolean(profile);
    base.trainerProfile = profile;
    base.stats = {
      clients: profile?.assignedCustomers?.length || 0,
      verified: profile?.isVerified || false,
      services: services.length,
      approvedServices: services.filter(
        (s) => s.isApproved || s.approvalStatus === "APPROVED"
      ).length,
      rejectedServices: services.filter((s) => s.approvalStatus === "REJECTED")
        .length,
    };
  }

  if (req.user.role === ROLES.SUPPLEMENT_PROVIDER) {
    const products = await SupplementProduct.find({ sellerId: req.user._id });
    const orders = await Order.countDocuments({ sellerId: req.user._id });
    base.onboardingComplete = products.length > 0;
    base.stats = {
      products: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      approvedProducts: products.filter(
        (p) => p.isApproved || p.approvalStatus === "APPROVED"
      ).length,
      pendingProducts: products.filter(
        (p) => !p.isApproved && p.approvalStatus !== "REJECTED"
      ).length,
      rejectedProducts: products.filter((p) => p.approvalStatus === "REJECTED")
        .length,
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

  const { name, description, location, facilities, timing, images } = req.body;

  if (!name?.trim()) {
    throw new AppError("Gym name is required", 400);
  }

  const gym = await Gym.create({
    ownerId: req.user._id,
    name: name.trim(),
    description: description?.trim() || "",
    location: sanitizeGymLocation(location || {}),
    facilities: facilities || [],
    timing: timing || [],
    images: images || [],
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
  if (location !== undefined) {
    const sanitized = sanitizeGymLocation(location);
    gym.location.address = sanitized.address;
    gym.location.city = sanitized.city;
    gym.location.state = sanitized.state;
    gym.location.pincode = sanitized.pincode;
    if (sanitized.coordinates) {
      gym.location.coordinates = sanitized.coordinates;
    }
    gym.markModified("location");
  }
  if (facilities !== undefined) gym.facilities = facilities;
  if (timing !== undefined) gym.timing = timing;
  if (images !== undefined) gym.images = images;

  if (
    gym.status === GYM_STATUS.APPROVED &&
    (name !== undefined || location !== undefined || images !== undefined)
  ) {
    gym.status = GYM_STATUS.PENDING;
  }

  await gym.save();

  res.json({
    success: true,
    message:
      gym.status === GYM_STATUS.PENDING
        ? "Gym profile updated. Changes require admin re-approval."
        : "Gym profile updated",
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

export const getProduct = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const product = await SupplementProduct.findOne({
    _id: req.params.id,
    sellerId: req.user._id,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  res.json({
    success: true,
    data: { product },
  });
});

export const createProduct = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const { name, description, category, brand, price, discountPrice, stock, images } =
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
    images: images || [],
    isApproved: false,
    approvalStatus: "PENDING",
    rejectionReason: "",
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
    images,
  } = req.body;

  const contentChanged =
    (name !== undefined && name.trim() !== product.name) ||
    (price !== undefined && Number(price) !== product.price) ||
    (category !== undefined && category !== product.category);

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
  if (images !== undefined) product.images = images;

  const wasRejected = product.approvalStatus === "REJECTED";
  const needsReapproval =
    contentChanged || wasRejected || (images !== undefined && product.isApproved);

  if (needsReapproval && (product.isApproved || wasRejected || product.approvalStatus === "APPROVED")) {
    product.isApproved = false;
    product.approvalStatus = "PENDING";
    product.rejectionReason = "";
  }

  await product.save();

  res.json({
    success: true,
    message:
      product.approvalStatus === "PENDING" && (contentChanged || wasRejected)
        ? "Product updated and resubmitted for admin approval."
        : "Product updated",
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

const getTrainerProfileOrFail = async (userId) => {
  const profile = await TrainerProfile.findOne({ userId });
  if (!profile) {
    throw new AppError("Trainer profile not found. Create one first.", 404);
  }
  return profile;
};

export const getTrainerServices = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  const services = await TrainerService.find({ trainerId: profile._id }).sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    data: { services },
  });
});

export const createTrainerService = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  const { name, description, serviceType, durationMinutes, price } = req.body;

  if (!name?.trim() || price === undefined) {
    throw new AppError("Service name and price are required", 400);
  }

  const service = await TrainerService.create({
    trainerId: profile._id,
    userId: req.user._id,
    name: name.trim(),
    description: description?.trim() || "",
    serviceType: serviceType || "PERSONAL",
    durationMinutes: Number(durationMinutes) || 60,
    price: Number(price),
    isApproved: false,
    approvalStatus: "PENDING",
    rejectionReason: "",
    isActive: true,
  });

  res.status(201).json({
    success: true,
    message: "Service created. Awaiting admin approval.",
    data: { service },
  });
});

export const updateTrainerService = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  const service = await TrainerService.findOne({
    _id: req.params.id,
    trainerId: profile._id,
  });

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  const { name, description, serviceType, durationMinutes, price, isActive } =
    req.body;

  const contentChanged =
    (name !== undefined && name.trim() !== service.name) ||
    (price !== undefined && Number(price) !== service.price);

  if (name !== undefined) service.name = name.trim();
  if (description !== undefined) service.description = description;
  if (serviceType !== undefined) service.serviceType = serviceType;
  if (durationMinutes !== undefined) {
    service.durationMinutes = Number(durationMinutes);
  }
  if (price !== undefined) service.price = Number(price);
  if (isActive !== undefined) service.isActive = isActive;

  const wasRejected = service.approvalStatus === "REJECTED";
  if (contentChanged || wasRejected) {
    if (service.isApproved || wasRejected || service.approvalStatus === "APPROVED") {
      service.isApproved = false;
      service.approvalStatus = "PENDING";
      service.rejectionReason = "";
    }
  }

  await service.save();

  res.json({
    success: true,
    message:
      service.approvalStatus === "PENDING" && (contentChanged || wasRejected)
        ? "Service updated and resubmitted for admin approval."
        : "Service updated",
    data: { service },
  });
});

export const deleteTrainerService = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  const service = await TrainerService.findOneAndDelete({
    _id: req.params.id,
    trainerId: profile._id,
  });

  if (!service) {
    throw new AppError("Service not found", 404);
  }

  res.json({
    success: true,
    message: "Service deleted",
  });
});
