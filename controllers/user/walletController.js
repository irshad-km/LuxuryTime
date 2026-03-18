import Razorpay from "razorpay";
import Wallet from "../../models/walletSchema.js";
import User from "../../models/userSchema.js";
import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    console.log("Received amount from frontend:", amount);

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const options = {
      amount: Number(amount) * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };

    console.log("Razorpay order options:", options);

    const order = await razorpay.orders.create(options);

    console.log("Created Razorpay order:", order);

    return res.status(200).json(order);

  } catch (error) {
    console.error("Razorpay Order Error:", error);
    return res.status(500).json({ error: "Order creation failed" });
  }
};

const loadwallet = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) return res.redirect("/login");

        const user= await User.findById(userId)

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
        res.render("user/wallet", { 
            user: req.session.user, 
            wallet, 
            user,
            razorpay_key: process.env.RAZORPAY_KEY_ID 
        });
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
};


const verifyPaymentadd = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        console.log("halo verificatoin start")
        
        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const userId = new mongoose.Types.ObjectId(req.session.user._id);

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ success: false });
        }

        const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
        console.log(razorpayOrder);
        
        const paidAmount = razorpayOrder.amount / 100;

        console.log(paidAmount);

        const result = await Wallet.findOneAndUpdate(
            { userId: req.session.user._id },
            {
                $inc: { balance: Number(paidAmount) },
                $push: {
                    transactions: {
                        amount: paidAmount,
                        transactionType: 'credit',
                        description: 'Money added to wallet',
                        source: 'wallet_topup',
                        date: new Date(),
                        status: 'success',
                        orderId: razorpay_order_id
                    }
                }
            },
            { upsert: true, new: true }
        );

        if (result) {
            res.status(200).json({ success: true });
        } else {
            res.status(500).json({ success: false, message: "DB Update Failed" });
        }

    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ error: "Verification failed" });
    }
};

export { loadwallet, createOrder, verifyPaymentadd };