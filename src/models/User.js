import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES, USER_STATUS } from "../utils/constants.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    profileImage: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 280,
    },
    wellnessPreferences: {
      type: [String],
      default: [],
    },
    fitnessGoals: {
      type: [String],
      default: [],
    },
    notificationSettings: {
      workoutReminders: { type: Boolean, default: true },
    },
    passwordChangedAt: {
      type: Date,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ phone: 1 }, { sparse: true });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone || "",
    role: this.role,
    status: this.status,
    profileImage: this.profileImage || "",
    bio: this.bio || "",
    wellnessPreferences: this.wellnessPreferences || [],
    fitnessGoals: this.fitnessGoals || [],
    notificationSettings: {
      workoutReminders: this.notificationSettings?.workoutReminders !== false,
    },
    passwordChangedAt: this.passwordChangedAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

export default User;
