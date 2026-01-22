// models/productSchema.js
import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
    trim: true
  },
  regularPrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0,
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  images: {
    type: [String],
    default: []
  }
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    variants: {
      type: [variantSchema],
      required: true
    },
    isListed: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type:Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
