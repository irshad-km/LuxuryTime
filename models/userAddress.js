import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullname: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    isDefault: {
      type: Boolean,
      default: false,
    },
    
  },
  { timestamps: true }
);

const Address = mongoose.model("Address", addressSchema);
export default Address;
