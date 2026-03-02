import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "flat"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    minPrice: {
        type: Number,
        default: 0
    },
    maxDiscAmount: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    maxUsageCount: {
        type: Number,
        required: true
    },
    usedUsers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);