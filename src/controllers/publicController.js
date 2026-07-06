import Gym from "../models/Gym.js";
import SupplementProduct from "../models/SupplementProduct.js";
import { AppError } from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getGyms = asyncHandler(async (req, res) => {
  const { search, city, status, page = 1, limit = 20 } = req.query;
  const filter = { status: "APPROVED" };

  if (status) filter.status = status;
  if (city) filter["location.city"] = { $regex: city, $options: "i" };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { "location.city": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [gyms, total] = await Promise.all([
    Gym.find(filter)
      .populate("ownerId", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Gym.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      gyms,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

export const getGymById = asyncHandler(async (req, res) => {
  const gym = await Gym.findById(req.params.id).populate(
    "ownerId",
    "name email phone"
  );

  if (!gym) {
    throw new AppError("Gym not found", 404);
  }

  res.json({
    success: true,
    data: { gym },
  });
});

export const getNearbyGyms = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 10 } = req.query;

  if (!lat || !lng) {
    throw new AppError("Latitude and longitude are required", 400);
  }

  const gyms = await Gym.find({
    status: "APPROVED",
    "location.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)],
        },
        $maxDistance: Number(radius) * 1000,
      },
    },
  }).limit(50);

  res.json({
    success: true,
    data: { gyms },
  });
});

export const getSupplements = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const filter = { isApproved: true, isActive: true };

  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [products, total] = await Promise.all([
    SupplementProduct.find(filter)
      .populate("sellerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SupplementProduct.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

export const getSupplementById = asyncHandler(async (req, res) => {
  const product = await SupplementProduct.findOne({
    _id: req.params.id,
    isApproved: true,
    isActive: true,
  }).populate("sellerId", "name email");

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  res.json({
    success: true,
    data: { product },
  });
});
