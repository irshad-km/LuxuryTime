import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true, 
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },

      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },

      name: String,
      quantity: Number,
      price: Number,
      discountAmount: Number,    
      finalPrice: Number,

      itemStatus: { type: String, default: 'Delivered' },
      images: {
        type: [String],
        default: []
      },

      variantIndex: Number,

      itemStatus: {
        type: String,
        enum: [
          "pending",
          "confirmed",
          "shipped",
          "out for delivery",
          "delivered",
          "Cancelled",
          "Partially Cancelled",
          "Return Requested",
          "Returned"
        ],
        default: "pending"
      },

      returnReason: String,
      returnedAt: Date
    }
  ],

  address: {
    fullname: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },

  subtotal: {
    type: Number,
    required: true
  },

  discount: {
    type: Number,
    default: 0
  },

  couponCode: {
    type: String,
    default: null
  },

  shippingCharge: {
    type: Number,
    default: 0
  },

  tax: {
    type: Number,
    default: 0
  },



  totalAmount: Number,

  paymentMethod: {
    type: String,
    enum: ["COD", "ONLINE","Wallet"],
  },

  paymentStatus: {
    type: String,
    default: "Pending",
  },

  orderStatus: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "shipped",
      "out for delivery",
      "delivered",
      "Cancelled",
      "Partially Cancelled",
      "Return Requested",
      "Returned"
    ],
    default: "pending"
  },


}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
