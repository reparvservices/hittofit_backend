import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import TrainerService from "../models/TrainerService.js";
import SupplementProduct from "../models/SupplementProduct.js";
import Order from "../models/Order.js";
import Membership from "../models/Membership.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  GYM_STATUS,
  ORDER_STATUS,
  ROLES,
  USER_STATUS,
} from "../utils/constants.js";

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

  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  if (req.user.role === ROLES.GYM_OWNER) {
    const gym = await Gym.findOne({ ownerId: req.user._id });
    base.onboardingComplete = Boolean(gym);
    base.gym = gym;

    let members = 0;
    let activeMembers = 0;
    let expiringSoon = 0;
    let revenue = 0;

    if (gym) {
      const memberships = await Membership.find({ gymId: gym._id });
      members = memberships.length;
      activeMembers = memberships.filter(
        (m) => m.isActive && new Date(m.endDate) >= now
      ).length;
      expiringSoon = memberships.filter(
        (m) =>
          m.isActive &&
          new Date(m.endDate) >= now &&
          new Date(m.endDate) <= weekAhead
      ).length;
      revenue = memberships
        .filter((m) => m.paymentStatus === "COMPLETED")
        .reduce((sum, m) => sum + (Number(m.plan?.price) || 0), 0);
    }

    base.stats = {
      plans: gym?.plans?.filter((p) => p.isActive).length || 0,
      status: gym?.status || "NOT_CREATED",
      members,
      activeMembers,
      expiringSoon,
      revenue,
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
      certificates: profile?.certificates?.length || 0,
      hourlyRate: profile?.hourlyRate || 0,
    };
  }

  if (req.user.role === ROLES.SUPPLEMENT_PROVIDER) {
    const products = await SupplementProduct.find({ sellerId: req.user._id });
    const orders = await Order.find({ sellerId: req.user._id });
    const openStatuses = [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPED,
    ];
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
      orders: orders.length,
      openOrders: orders.filter((o) => openStatuses.includes(o.status)).length,
      lowStock: products.filter((p) => Number(p.stock) <= 5).length,
      revenue: orders
        .filter((o) => o.status !== ORDER_STATUS.CANCELLED)
        .reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
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

  const { name, description, location, facilities, timing, images, verificationDocuments } =
    req.body;

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
    verificationDocuments: verificationDocuments || [],
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

  const { name, description, location, facilities, timing, images, verificationDocuments } =
    req.body;

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
  if (verificationDocuments !== undefined) {
    gym.verificationDocuments = verificationDocuments;
  }

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

  const { bio, experience, skills, specializations, hourlyRate, gymId, certificates } =
    req.body;

  const profile = await TrainerProfile.create({
    userId: req.user._id,
    bio: bio?.trim() || "",
    experience: Number(experience) || 0,
    skills: skills || [],
    specializations: specializations || [],
    hourlyRate: Number(hourlyRate) || 0,
    gymId: gymId || undefined,
    certificates: Array.isArray(certificates) ? certificates : [],
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

  const { bio, experience, skills, specializations, hourlyRate, gymId, certificates } =
    req.body;

  if (bio !== undefined) profile.bio = bio;
  if (experience !== undefined) profile.experience = Number(experience);
  if (skills !== undefined) profile.skills = skills;
  if (specializations !== undefined) profile.specializations = specializations;
  if (hourlyRate !== undefined) profile.hourlyRate = Number(hourlyRate);
  if (gymId !== undefined) profile.gymId = gymId || undefined;
  if (certificates !== undefined) {
    profile.certificates = Array.isArray(certificates) ? certificates : [];
  }

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

const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

export const getMemberships = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.GYM_OWNER]);

  const gym = await Gym.findOne({ ownerId: req.user._id });
  if (!gym) {
    throw new AppError("Gym profile not found. Create one first.", 404);
  }

  const filter = { gymId: gym._id };
  if (req.query.status === "active") {
    filter.isActive = true;
    filter.endDate = { $gte: new Date() };
  } else if (req.query.status === "expired") {
    filter.$or = [{ isActive: false }, { endDate: { $lt: new Date() } }];
  }

  const memberships = await Membership.find(filter)
    .populate("customerId", "name email phone profileImage")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { memberships, gym: { _id: gym._id, name: gym.name } },
  });
});

export const getOrders = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const filter = { sellerId: req.user._id };
  if (req.query.status && Object.values(ORDER_STATUS).includes(req.query.status)) {
    filter.status = req.query.status;
  }

  const orders = await Order.find(filter)
    .populate("customerId", "name email phone")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { orders },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user._id,
  }).populate("customerId", "name email phone");

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  res.json({
    success: true,
    data: { order },
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.SUPPLEMENT_PROVIDER]);

  const { status } = req.body;
  if (!status || !Object.values(ORDER_STATUS).includes(status)) {
    throw new AppError("Valid order status is required", 400);
  }

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user._id,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot move order from ${order.status} to ${status}`,
      400
    );
  }

  order.status = status;
  await order.save();
  await order.populate("customerId", "name email phone");

  res.json({
    success: true,
    message: `Order marked as ${status}`,
    data: { order },
  });
});

export const getClients = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  await profile.populate("assignedCustomers", "name email phone profileImage status");

  res.json({
    success: true,
    data: { clients: profile.assignedCustomers || [] },
  });
});

export const addClient = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();
  if (!email) {
    throw new AppError("Customer email is required", 400);
  }

  const customer = await User.findOne({
    email,
    role: ROLES.CUSTOMER,
  });

  if (!customer) {
    throw new AppError("No customer account found with that email", 404);
  }

  if (
    customer.status === USER_STATUS.BLOCKED ||
    customer.status === USER_STATUS.REJECTED
  ) {
    throw new AppError("This customer account is not available", 400);
  }

  const profile = await getTrainerProfileOrFail(req.user._id);
  const alreadyAssigned = (profile.assignedCustomers || []).some(
    (id) => String(id) === String(customer._id)
  );

  if (alreadyAssigned) {
    throw new AppError("Customer is already assigned to you", 409);
  }

  profile.assignedCustomers.push(customer._id);
  await profile.save();
  await profile.populate("assignedCustomers", "name email phone profileImage status");

  res.status(201).json({
    success: true,
    message: "Client added",
    data: { clients: profile.assignedCustomers },
  });
});

export const removeClient = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const profile = await getTrainerProfileOrFail(req.user._id);
  const before = profile.assignedCustomers.length;
  profile.assignedCustomers = profile.assignedCustomers.filter(
    (id) => String(id) !== String(req.params.customerId)
  );

  if (profile.assignedCustomers.length === before) {
    throw new AppError("Client not found", 404);
  }

  await profile.save();
  await profile.populate("assignedCustomers", "name email phone profileImage status");

  res.json({
    success: true,
    message: "Client removed",
    data: { clients: profile.assignedCustomers },
  });
});

export const getPartnerGymOptions = asyncHandler(async (req, res) => {
  assertPartnerRole(req.user, [ROLES.TRAINER]);

  const gyms = await Gym.find({ status: GYM_STATUS.APPROVED })
    .select("name location.city status")
    .sort({ name: 1 })
    .limit(200);

  res.json({
    success: true,
    data: { gyms },
  });
});
