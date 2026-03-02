import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    transactions: [
      {
        transactionType: {
          type: String,
          enum: ["credit", "debit"],
          required: true,
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },

        status: {
          type: String,
          enum: ["success", "failed", "pending"],
          default: "success",
        },

        source: {
          type: String,
          enum: [
            "order_payment",
            "order_cancel",
            "order_return",
            "wallet_topup",
            "referral_bonus",
          ],
          required: true,
        },

        orderId: {
          type: String, 
        },

        description: {
          type: String,
        },

        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", walletSchema);