import mongoose from "mongoose";

export const SERVICE_APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const trainerServiceSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainerProfile",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
    },
    description: { type: String, default: "" },
    serviceType: {
      type: String,
      enum: ["PERSONAL", "GROUP", "ONLINE", "CONSULTATION"],
      default: "PERSONAL",
    },
    durationMinutes: { type: Number, default: 60, min: 15 },
    price: { type: Number, required: true, min: 0 },
    isApproved: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: Object.values(SERVICE_APPROVAL_STATUS),
      default: SERVICE_APPROVAL_STATUS.PENDING,
    },
    rejectionReason: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainerServiceSchema.index({ trainerId: 1, isApproved: 1 });
trainerServiceSchema.index({ userId: 1 });
trainerServiceSchema.index({ approvalStatus: 1 });

const TrainerService = mongoose.model("TrainerService", trainerServiceSchema);

export default TrainerService;
