import Order from "../../models/orderSchema.js";
import Cart from "../../models/cartSchema.js";
import Address from "../../models/userAddress.js";
import Product from "../../models/productSchema.js";

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
            if (!item.product || item.product.isListed === false) {
                return res.redirect("/cart?error=Product unavailable");
            }
            const variant = item.product.variants[item.variantIndex];
            if (!variant || variant.quantity < item.quantity) {
                return res.redirect(`/cart?error=Insufficient stock for ${item.product.name}`);
            }
        }

        const orderItems = cart.items.map(item => {
            const variant = item.product.variants[item.variantIndex];
            return {
                productId: item.product._id,
                variantId: new mongoose.Types.ObjectId(variant._id),
                name: item.product.name,
                quantity: item.quantity,
                price: item.price,
                images: variant?.images || [],
                variantIndex: item.variantIndex,
                itemStatus: "pending"
            };
        });

        const newOrder = new Order({
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
            totalAmount: cart.grandTotal,
            paymentMethod: paymentMethod === "Card" ? "ONLINE" : "COD",
            paymentStatus: paymentMethod === "Card" ? "paid" : "pending",
            orderStatus: "pending"
        });

        const savedOrder = await newOrder.save();

        for (let item of cart.items) {
            const stockKey = `variants.${item.variantIndex}.quantity`;
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { [stockKey]: -item.quantity }
            });
        }

        await Cart.findOneAndDelete({ user: userId });

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

export { placeOrder, loadSuccess };
