import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import SupplementProduct from "../models/SupplementProduct.js";
import Membership from "../models/Membership.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Wishlist from "../models/Wishlist.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_TYPES, ROLES } from "../utils/constants.js";

const assertCustomer = (user) => {
  if (user.role !== ROLES.CUSTOMER) {
    throw new AppError("Customer access required", 403);
  }
};

const getOrCreateWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, items: [] });
  }
  return wishlist;
};

const hydrateWishlistItems = async (items) => {
  const hydrated = [];

  for (const item of items) {
    if (item.itemType === "GYM") {
      const gym = await Gym.findOne({ _id: item.itemId, status: "APPROVED" });
      if (gym) {
        hydrated.push({
          id: item._id,
          itemType: "GYM",
          itemId: gym._id,
          title: gym.name,
          subtitle: [gym.location?.city, gym.location?.state].filter(Boolean).join(", "),
          image: gym.images?.[0] || "",
          meta: gym.rating ? `★ ${Number(gym.rating).toFixed(1)}` : "Gym",
          href: `/gyms/${gym._id}`,
        });
      }
    } else if (item.itemType === "TRAINER") {
      const trainer = await TrainerProfile.findOne({
        _id: item.itemId,
        isVerified: true,
      }).populate("userId", "name profileImage");
      if (trainer?.userId) {
        hydrated.push({
          id: item._id,
          itemType: "TRAINER",
          itemId: trainer._id,
          title: trainer.userId.name,
          subtitle:
            trainer.specializations?.[0] || trainer.skills?.[0] || "Trainer",
          image: trainer.userId.profileImage || "",
          meta: trainer.hourlyRate
            ? `₹${trainer.hourlyRate}/hr`
            : "Trainer",
          href: `/trainers/${trainer._id}`,
        });
      }
    } else if (item.itemType === "PRODUCT") {
      const product = await SupplementProduct.findOne({
        _id: item.itemId,
        isApproved: true,
        isActive: true,
      });
      if (product) {
        hydrated.push({
          id: item._id,
          itemType: "PRODUCT",
          itemId: product._id,
          title: product.name,
          subtitle: product.brand || product.category || "Supplement",
          image: product.images?.[0] || "",
          meta: `₹${product.discountPrice ?? product.price}`,
          href: `/supplements/${product._id}`,
        });
      }
    }
  }

  return hydrated;
};

export const getDashboard = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const [memberships, orders, wishlist] = await Promise.all([
    Membership.countDocuments({ customerId: req.user._id, isActive: true }),
    Order.countDocuments({ customerId: req.user._id }),
    getOrCreateWishlist(req.user._id),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        activeMemberships: memberships,
        orders,
        wishlistItems: wishlist.items.length,
      },
    },
  });
});

export const getWishlist = asyncHandler(async (req, res) => {
  assertCustomer(req.user);
  const wishlist = await getOrCreateWishlist(req.user._id);
  const items = await hydrateWishlistItems(wishlist.items);

  res.json({
    success: true,
    data: { items },
  });
});

export const addWishlistItem = asyncHandler(async (req, res) => {
  assertCustomer(req.user);
  const { itemType, itemId } = req.body;

  if (!["GYM", "TRAINER", "PRODUCT"].includes(itemType) || !itemId) {
    throw new AppError("itemType and itemId are required", 400);
  }

  const wishlist = await getOrCreateWishlist(req.user._id);
  const exists = wishlist.items.some(
    (item) =>
      item.itemType === itemType && String(item.itemId) === String(itemId)
  );

  if (!exists) {
    wishlist.items.push({ itemType, itemId });
    await wishlist.save();
  }

  const items = await hydrateWishlistItems(wishlist.items);

  res.status(201).json({
    success: true,
    message: "Added to wishlist",
    data: { items },
  });
});

export const removeWishlistItem = asyncHandler(async (req, res) => {
  assertCustomer(req.user);
  const wishlist = await getOrCreateWishlist(req.user._id);
  wishlist.items = wishlist.items.filter(
    (item) => String(item._id) !== String(req.params.itemId)
  );
  await wishlist.save();

  const items = await hydrateWishlistItems(wishlist.items);

  res.json({
    success: true,
    message: "Removed from wishlist",
    data: { items },
  });
});

export const getMemberships = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const memberships = await Membership.find({ customerId: req.user._id })
    .populate("gymId", "name images location status")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { memberships },
  });
});

export const createMembership = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const { gymId, planId } = req.body;
  if (!gymId || !planId) {
    throw new AppError("gymId and planId are required", 400);
  }

  const gym = await Gym.findOne({ _id: gymId, status: "APPROVED" });
  if (!gym) {
    throw new AppError("Gym not found", 404);
  }

  const plan = (gym.plans || []).id(planId) ||
    (gym.plans || []).find((p) => String(p._id) === String(planId));

  if (!plan || plan.isActive === false) {
    throw new AppError("Membership plan not found", 404);
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(plan.durationDays));

  const payment = await Payment.create({
    userId: req.user._id,
    amount: plan.price,
    type: PAYMENT_TYPES.MEMBERSHIP,
    status: PAYMENT_STATUS.COMPLETED,
    metadata: { gymId, planId },
  });

  const membership = await Membership.create({
    customerId: req.user._id,
    gymId: gym._id,
    plan: {
      planId: plan._id,
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
    },
    startDate,
    endDate,
    paymentStatus: PAYMENT_STATUS.COMPLETED,
    isActive: true,
  });

  await membership.populate("gymId", "name images location");

  res.status(201).json({
    success: true,
    message: "Membership activated",
    data: { membership, paymentId: payment._id },
  });
});

export const getOrders = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const orders = await Order.find({ customerId: req.user._id })
    .populate("sellerId", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { orders },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const order = await Order.findOne({
    _id: req.params.id,
    customerId: req.user._id,
  }).populate("sellerId", "name email phone");

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  res.json({
    success: true,
    data: { order },
  });
});

export const createOrder = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const { productId, quantity = 1, shippingAddress } = req.body;

  if (!productId) {
    throw new AppError("productId is required", 400);
  }

  if (
    !shippingAddress?.fullName ||
    !shippingAddress?.phone ||
    !shippingAddress?.addressLine ||
    !shippingAddress?.city ||
    !shippingAddress?.pincode
  ) {
    throw new AppError("Complete shipping address is required", 400);
  }

  const product = await SupplementProduct.findOne({
    _id: productId,
    isApproved: true,
    isActive: true,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const qty = Math.max(1, Number(quantity) || 1);
  if (product.stock < qty) {
    throw new AppError("Insufficient stock", 400);
  }

  const unitPrice = product.discountPrice ?? product.price;
  const amount = unitPrice * qty;

  const payment = await Payment.create({
    userId: req.user._id,
    amount,
    type: PAYMENT_TYPES.SUPPLEMENT_ORDER,
    status: PAYMENT_STATUS.COMPLETED,
    metadata: { productId, quantity: qty },
  });

  const order = await Order.create({
    customerId: req.user._id,
    sellerId: product.sellerId,
    products: [
      {
        productId: product._id,
        name: product.name,
        price: unitPrice,
        quantity: qty,
      },
    ],
    amount,
    shippingAddress: {
      fullName: shippingAddress.fullName.trim(),
      phone: shippingAddress.phone.trim(),
      addressLine: shippingAddress.addressLine.trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state?.trim() || "",
      pincode: shippingAddress.pincode.trim(),
    },
    status: ORDER_STATUS.PROCESSING,
    paymentId: payment._id,
  });

  product.stock = Math.max(0, product.stock - qty);
  await product.save();

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    data: { order },
  });
});

export const getPayments = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const payments = await Payment.find({ userId: req.user._id }).sort({
    createdAt: -1,
  });

  res.json({
    success: true,
    data: { payments },
  });
});

export const getActivity = asyncHandler(async (req, res) => {
  assertCustomer(req.user);

  const [memberships, orders] = await Promise.all([
    Membership.find({ customerId: req.user._id })
      .populate("gymId", "name")
      .sort({ createdAt: -1 })
      .limit(10),
    Order.find({ customerId: req.user._id }).sort({ createdAt: -1 }).limit(10),
  ]);

  const activities = [
    ...memberships.map((m) => ({
      id: `membership-${m._id}`,
      type: "MEMBERSHIP",
      title: `Membership: ${m.plan?.name}`,
      subtitle: m.gymId?.name || "Gym",
      status: m.isActive ? "Active" : "Inactive",
      createdAt: m.createdAt,
      href: "/mymembership",
    })),
    ...orders.map((o) => ({
      id: `order-${o._id}`,
      type: "ORDER",
      title: `Order #${String(o._id).slice(-6).toUpperCase()}`,
      subtitle: o.products?.[0]?.name || "Supplement order",
      status: o.status,
      createdAt: o.createdAt,
      href: `/orderconfrimation?orderId=${o._id}`,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    data: { activities },
  });
});
