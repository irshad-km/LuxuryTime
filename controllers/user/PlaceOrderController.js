import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Cart from "../../models/cartSchema.js";
import Wallet from "../../models/walletSchema.js";
import Address from "../../models/userAddress.js";
import Product from "../../models/productSchema.js";
import Coupon from "../../models/couponSchema.js";
import crypto from "crypto";

import mongoose from "mongoose";


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) return res.redirect("/login");

        const { addressId, paymentMethod } = req.body;

        const cart = await Cart.findOne({ user: userId }).populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?error=Your cart is empty");
        }

        const addressData = await Address.findOne({ _id: addressId, userId });
        if (!addressData) {
            return res.redirect("/checkout?error=Invalid address selection");
        }

        for (let item of cart.items) {

            if (!item.product) {
                return res.redirect("/cart?error=Product removed");
            }

            const product = await Product.findById(item.product._id)
                .populate("category");

            if (!product || product.isDeleted || !product.isListed) {
                return res.redirect(`/cart?error=${item.product.name} is unavailable`);
            }

            if (!product.category || !product.category.isListed) {
                return res.redirect(`/cart?error=${item.product.name} category is unavailable`);
            }

            const variant = product.variants?.[item.variantIndex];

            if (!variant) {
                return res.redirect(`/cart?error=${product.name} variant unavailable`);
            }

            if (variant.quantity <= 0) {
                return res.redirect(`/cart?error=${product.name} is out of stock`);
            }

            if (variant.quantity < item.quantity) {
                return res.redirect(`/cart?error=Only ${variant.quantity} left for ${product.name}`);
            }
        }



        let subtotal = 0;
        for (let item of cart.items) {
            subtotal += item.price * item.quantity;
        }

        let discount = 0;
        let couponCode = null;
        let couponId = null;

        console.log(couponId)

        const appliedCoupon = req.session.appliedCoupon || null;

        if (appliedCoupon) {
            discount = appliedCoupon.discount || 0;
            couponCode = appliedCoupon.code || null;
            console.log("coupon code", couponCode);
            couponId = appliedCoupon._id || null;
            console.log("couponId", couponId)
        }

        const shippingCharge = 0;
        const tax = 0;

        const totalAmount = subtotal - discount + shippingCharge + tax;


        if (totalAmount < 0) {
            return res.redirect("/checkout?error=Invalid total amount");
        }



        if (paymentMethod === "Wallet") {

            const wallet = await Wallet.findOne({ userId: userId });

            if (!wallet) {
                return res.redirect("/checkout?error=Wallet not found");
            }

            if (wallet.balance < totalAmount) {
                return res.redirect("/checkout?error=Insufficient wallet balance");
            }

            wallet.balance -= totalAmount;
            await wallet.save();
        }

        const orderItems = cart.items.map(item => {
            const variant = item.product.variants[item.variantIndex];

            return {
                productId: item.product._id,
                variantId: new mongoose.Types.ObjectId(variant._id),
                name: item.product.name,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.price * item.quantity,
                images: variant?.images || [],
                variantIndex: item.variantIndex,
                itemStatus: "pending"
            };
        });

        const customOrderId = `LW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        let finalPaymentMethod = "COD";
        let finalPaymentStatus = "Pending";

        if (paymentMethod === "Card") {
            finalPaymentMethod = "ONLINE";
            finalPaymentStatus = "Paid";
        }
        else if (paymentMethod === "Wallet") {
            finalPaymentMethod = "Wallet";
            finalPaymentStatus = "Paid";
        }
        else {
            finalPaymentMethod = "COD";
            finalPaymentStatus = "Pending";
        }

        const newOrder = new Order({
            orderId: customOrderId,
            userId,
            items: orderItems,
            address: {
                fullname: addressData.fullname,
                phone: addressData.phone,
                street: addressData.address,
                city: addressData.city,
                state: addressData.state,
                pincode: addressData.pincode,
                country: addressData.country || 'India',
            },

            subtotal,
            discount,
            couponCode,
            shippingCharge,
            tax,
            totalAmount,

            paymentMethod: finalPaymentMethod,
            paymentStatus: finalPaymentStatus,
            orderStatus: "pending"
        });

        const savedOrder = await newOrder.save();

        if (couponCode) {
            await Coupon.findOneAndUpdate(
                { code: couponCode },
                { $addToSet: { usedUsers: userId } }
            );
            console.log("Coupon updated using Code:", couponCode);
        }



        for (let item of cart.items) {
            const stockKey = `variants.${item.variantIndex}.quantity`;

            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { [stockKey]: -item.quantity }
            });
        }

        await Cart.findOneAndDelete({ user: userId });


        req.session.appliedCoupon = null;

        req.session.orderCompleted = true;
        req.session.lastOrderId = savedOrder._id.toString();


        res.redirect(`/order-success/${savedOrder._id}`);

    } catch (error) {
        console.error("Place Order Error:", error);
        res.redirect("/cart?error=Unexpected error occurred.");
    }
};


const loadSuccess = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (
            !req.session.orderCompleted ||
            req.session.lastOrderId !== orderId
        ) {
            return res.redirect("/");
        }

        const order = await Order.findById(orderId).populate("items.productId");

        if (!order) return res.redirect("/");

        req.session.orderCompleted = false;
        req.session.lastOrderId = null;

        res.render("user/success", { order });
    } catch (error) {
        console.error(error);
        res.redirect("/");
    }
};


const PaymentError = async (req, res) => {
    try {
        const errorMessage = req.query.msg || "Transaction failed or was cancelled.";
        res.render('user/paymenderror', {
            message: errorMessage
        });
    } catch (error) {
        res.redirect('/checkout');
    }
};

export {
    placeOrder,
    loadSuccess,
    PaymentError
};
