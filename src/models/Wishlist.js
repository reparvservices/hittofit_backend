import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["GYM", "TRAINER", "PRODUCT"],
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: true, timestamps: true }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [wishlistItemSchema],
  },
  { timestamps: true }
);

// userId already has unique: true (creates the index) — don't add a second one

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;
