import mongoose from "mongoose";
import { GYM_STATUS } from "../utils/constants.js";

const membershipPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const timingSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
      required: true,
    },
    open: { type: String, required: true },
    close: { type: String, required: true },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const gymSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Gym name is required"],
      trim: true,
    },
    description: { type: String, default: "" },
    location: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    images: [{ type: String }],
    facilities: [{ type: String }],
    timing: [timingSchema],
    plans: [membershipPlanSchema],
    status: {
      type: String,
      enum: Object.values(GYM_STATUS),
      default: GYM_STATUS.PENDING,
    },
    verificationDocuments: [{ type: String }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

gymSchema.index({ "location.coordinates": "2dsphere" });
gymSchema.index({ ownerId: 1 });
gymSchema.index({ status: 1, name: 1 });

const Gym = mongoose.model("Gym", gymSchema);

export default Gym;
