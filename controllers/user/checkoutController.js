import Cart from "../../models/cartSchema.js";
import Address from "../../models/userAddress.js";
import Coupon from "../../models/couponSchema.js";
import Orders from "../../models/orderSchema.js";
import Wallet from "../../models/walletSchema.js";
import mongoose from "mongoose";


const loadcheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect("/login");
        }

        let cart = await Cart.findOne({ user: userId })
            .populate({
                path: "items.product",
                populate: { path: "category" }
            });

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?error=Your cart is empty.");
        }

          const wallet = await Wallet.findOne({userId});


        const coupon = await Coupon.find({ isActive: true });
        let subtotal = 0;

        for (let item of cart.items) {
            if (!item.product || item.product.isDeleted || !item.product.isListed ||
                !item.product.category || !item.product.category.isListed) {
                return res.redirect("/cart?error=Some products are unavailable.");
            }

            const product = item.product;
            const variant = product.variants?.[item.variantIndex];

            if (!variant) {
                return res.redirect("/cart?error=Variant unavailable.");
            }

            if (variant.quantity < item.quantity) {
                return res.redirect(`/cart?error=Stock changed for ${product.name}.`);
            }


            const reglPrice = variant.salePrice || 0;
            const variantOffer = variant.offer || 0;
            const categoryOffer = product.category?.offer || 0;
            const bestOffer = Math.max(variantOffer, categoryOffer);

            const latestPrice = Math.floor(reglPrice - (reglPrice * (bestOffer / 100)));


            if (item.price !== latestPrice) {
                return res.redirect(`/cart?error=Price updated for ${product.name}. Please review your cart.`);
            }

            subtotal += item.quantity * latestPrice;
        }

        let discount = 0;
        let appliedCoupon = null;

        if (req.session.appliedCoupon) {
            const couponData = await Coupon.findById(req.session.appliedCoupon.couponId);

            if (couponData) {
                const isExpired = new Date(couponData.expiryDate) < new Date();

                if (!isExpired && subtotal >= couponData.minPrice) {
                    if (couponData.discountType === "flat") {
                        discount = couponData.discountValue;
                    } else if (couponData.discountType === "percentage") {
                        discount = Math.floor((subtotal * couponData.discountValue) / 100);
                        if (couponData.maxDiscAmount > 0 && discount > couponData.maxDiscAmount) {
                            discount = couponData.maxDiscAmount;
                        }
                    }

                    if (discount > subtotal) discount = subtotal;
                    appliedCoupon = couponData;
                } else {
                    req.session.appliedCoupon = null;
                }
            }
        }

        const grandTotal = subtotal - discount;


        cart.subtotal = subtotal;
        cart.grandTotal = grandTotal;
        await cart.save();

        const userAddresses = await Address.find({ userId: userId });

        res.render("user/checkout", {
            cart,
            address: userAddresses,
            coupon,
            discount,
            appliedCoupon,
            grandTotal,
            wallet

        });

    } catch (error) {
        console.error("Checkout Load Error:", error);
        res.status(500).send("Error loading checkout");
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        const { fullname, phone, address, city, state, pincode } = req.body;

        if (!fullname || !phone || !address || !city || !state || !pincode) {
            return res.redirect("/checkout?error=Please fill all fields.");
        }

        const newAddress = new Address({
            userId: userId,
            fullname: fullname,
            phone: phone,
            street: address,
            city: city,
            state: state,
            pincode: pincode,
            country: "India",
        })

        await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } })

        await newAddress.save()

        res.redirect("/checkout");

    } catch (error) {
        console.error("Add Checkout Address Error:", error);
        res.status(500).send("Error adding address");
    }
}

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const addressId = req.body.addressId;

        if (!userId) return res.redirect("/login");

        const { fullname, phone, address, city, state, pincode } = req.body;

        if (!fullname || !phone || !address || !city || !state || !pincode) {
            return res.redirect("/checkout?error=Please fill all fields.");
        }

        await Address.findOneAndUpdate(
            { _id: addressId, userId: userId },
            {
                fullname,
                phone,
                street: address,
                city,
                state,
                pincode
            }
        );

        res.redirect("/checkout");

    } catch (error) {
        console.error("Edit Address Error:", error);
        res.redirect("/checkout?error=Failed to edit address");
    }
};


const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login" });
        }

        if (!couponCode) {
            return res.json({ success: false, message: "Enter coupon code" });
        }

        const coupon = await Coupon.findOne({
            code: couponCode.trim().toUpperCase(),
        });

        if (!coupon) {
            return res.json({ success: false, message: "Invalid coupon code" });
        }

        if (new Date(coupon.expiryDate) < new Date()) {
            return res.json({ success: false, message: "Coupon expired" });
        }

        if (coupon.usedUsers.length >= coupon.maxUsageCount) {
            return res.json({ success: false, message: "Coupon usage limit exceeded" });
        }

        const alreadyUsed = coupon.usedUsers.some(
            id => id.toString() === userId.toString()
        );

        if (alreadyUsed) {
            return res.json({ success: false, message: "You already used this coupon" });
        }

        const cartData = await Cart.findOne({ user: userId }).populate("items.product");

        if (!cartData || cartData.items.length === 0) {
            return res.json({ success: false, message: "Cart is empty" });
        }

        let cartTotal = 0;

        for (const item of cartData.items) {
            if (!item.product) continue;

            const price =
                item.price ||
                item.product.salePrice ||
                item.product.price;

            cartTotal += price * item.quantity;
        }


        if (cartTotal < coupon.minPrice) {
            return res.json({
                success: false,
                message: `Minimum purchase ₹${coupon.minPrice} required`
            });
        }


        let discount = 0;

        if (coupon.discountType === "flat") {
            discount = coupon.discountValue;
        }

        if (coupon.discountType === "percentage") {
            discount = (cartTotal * coupon.discountValue) / 100;


            if (coupon.maxDiscAmount > 0 && discount > coupon.maxDiscAmount) {
                discount = coupon.maxDiscAmount;
            }
        }

        if (discount > cartTotal) {
            discount = cartTotal;
        }

        const finalAmount = cartTotal - discount;

        req.session.appliedCoupon = {
            couponId: coupon._id,
            code: coupon.code,
            discount
        };

        return res.json({
            success: true,
            discount,
            finalAmount
        });

    } catch (error) {
        console.error("Apply Coupon Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const applied = req.session.appliedCoupon;

        if (!userId) return res.status(401).json({ success: false, message: "Login required" });

        if (applied) {
            await Coupon.findByIdAndUpdate(applied.couponId, {
                $pull: { usedUsers: userId }
            });
        }

        req.session.appliedCoupon = null;

        const cart = await Cart.findOne({ user: userId });
        let currentSubtotal = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        return res.json({
            success: true,
            message: "Coupon removed successfully",
            newTotal: currentSubtotal
        });
    } catch (error) {
        console.error("Remove Coupon Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


export {
    loadcheckout,
    addAddress,
    editAddress,
    applyCoupon,
    removeCoupon
}

