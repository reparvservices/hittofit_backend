import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    issuer: { type: String, default: "" },
    year: { type: Number },
    documentUrl: { type: String, default: "" },
  },
  { _id: false }
);

const trainerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gym",
    },
    bio: { type: String, default: "" },
    experience: { type: Number, default: 0, min: 0 },
    skills: [{ type: String }],
    specializations: [{ type: String }],
    certificates: [certificateSchema],
    assignedCustomers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    hourlyRate: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

trainerProfileSchema.index({ gymId: 1 });
trainerProfileSchema.index({ isVerified: 1 });

const TrainerProfile = mongoose.model("TrainerProfile", trainerProfileSchema);

export default TrainerProfile;
