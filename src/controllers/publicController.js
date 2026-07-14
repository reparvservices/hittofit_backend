import Gym from "../models/Gym.js";
import TrainerProfile from "../models/TrainerProfile.js";
import TrainerService from "../models/TrainerService.js";
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
  const gym = await Gym.findOne({
    _id: req.params.id,
    status: "APPROVED",
  }).populate("ownerId", "name email phone");

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

export const getTrainers = asyncHandler(async (req, res) => {
  const { search, gymId, page = 1, limit = 20 } = req.query;
  const filter = { isVerified: true };

  if (gymId) filter.gymId = gymId;

  const skip = (Number(page) - 1) * Number(limit);

  let trainers = await TrainerProfile.find(filter)
    .populate({
      path: "userId",
      select: "name email profileImage status",
      match: { status: "ACTIVE" },
    })
    .populate("gymId", "name location.city")
    .sort({ rating: -1, createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  trainers = trainers.filter((trainer) => trainer.userId);

  if (search) {
    const term = search.toLowerCase();
    trainers = trainers.filter((trainer) => {
      const name = trainer.userId?.name?.toLowerCase() || "";
      const skills = (trainer.skills || []).join(" ").toLowerCase();
      const specs = (trainer.specializations || []).join(" ").toLowerCase();
      return name.includes(term) || skills.includes(term) || specs.includes(term);
    });
  }

  const total = await TrainerProfile.countDocuments(filter);

  res.json({
    success: true,
    data: {
      trainers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
});

export const getTrainerById = asyncHandler(async (req, res) => {
  const trainer = await TrainerProfile.findOne({
    _id: req.params.id,
    isVerified: true,
  })
    .populate({
      path: "userId",
      select: "name email profileImage status phone",
      match: { status: "ACTIVE" },
    })
    .populate("gymId", "name location");

  if (!trainer?.userId) {
    throw new AppError("Trainer not found", 404);
  }

  res.json({
    success: true,
    data: { trainer },
  });
});

export const getTrainerServices = asyncHandler(async (req, res) => {
  const trainer = await TrainerProfile.findOne({
    _id: req.params.id,
    isVerified: true,
  });

  if (!trainer) {
    throw new AppError("Trainer not found", 404);
  }

  const services = await TrainerService.find({
    trainerId: trainer._id,
    isApproved: true,
    isActive: true,
  }).sort({ price: 1 });

  res.json({
    success: true,
    data: { services },
  });
});
