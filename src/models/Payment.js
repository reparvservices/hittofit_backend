import mongoose from "mongoose";
import { PAYMENT_STATUS, PAYMENT_TYPES } from "../utils/constants.js";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: Object.values(PAYMENT_TYPES),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceModel: {
      type: String,
      enum: ["Membership", "Order", "TrainerSession"],
    },
    transactionId: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ type: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
