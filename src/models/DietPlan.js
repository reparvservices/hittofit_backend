import mongoose from "mongoose";

const mealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    time: { type: String, default: "" },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fats: { type: Number, default: 0 },
    items: [{ type: String }],
    notes: { type: String, default: "" },
  },
  { _id: true }
);

const dietPlanSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: "Diet Plan" },
    meals: [mealSchema],
    dailyCalorieTarget: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dietPlanSchema.index({ trainerId: 1, customerId: 1 });

const DietPlan = mongoose.model("DietPlan", dietPlanSchema);

export default DietPlan;
