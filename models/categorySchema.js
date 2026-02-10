import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        description: {
            type: String,
            trim: true
        },
        offer: {
            type: Number,
            default: 0
        },
        offerExpiry: {
            type: Date
        },
        isListed: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

const category = mongoose.model("Category", categorySchema);
export default category
