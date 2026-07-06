import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../utils/constants.js";

const membershipSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gym",
      required: true,
    },
    plan: {
      planId: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      durationDays: { type: Number, required: true, min: 1 },
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

membershipSchema.index({ customerId: 1, gymId: 1 });
membershipSchema.index({ endDate: 1, isActive: 1 });

const Membership = mongoose.model("Membership", membershipSchema);

export default Membership;
