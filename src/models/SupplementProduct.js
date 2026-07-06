import mongoose from "mongoose";

const supplementProductSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }],
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

supplementProductSchema.index({ sellerId: 1 });
supplementProductSchema.index({ isApproved: 1, isActive: 1, name: 1 });

const SupplementProduct = mongoose.model(
  "SupplementProduct",
  supplementProductSchema
);

export default SupplementProduct;
