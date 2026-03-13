import Order from "../../models/orderSchema.js";
import User from "../../models/userSchema.js";
import Product from "../../models/productSchema.js";
import Wallet from "../../models/walletSchema.js";


import mongoose from "mongoose";

const loadOrders = async (req, res) => {
    try {
        
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        let query = {};
        if (search) {
            query = {
                "address.fullname": { $regex: search, $options: "i" }
            };
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();


        res.render("admin/orders", {
            orders,
            currentPage: page,
            totalPages,
            search
        });
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

const loadordersdetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid Order ID");
        }

        const order = await Order.findById(orderId)
            .populate("userId")
            .lean();

            console.log(order)


        if (!order) {
            return res.status(404).render("404", { message: "Order not found" });
        }

        res.render("admin/orderDetails", { order });
    } catch (error) {
        console.error("Error loading admin order details:", error);
        res.status(500).send("Internal Server Error");
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send("Invalid Order ID");
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).send("Order not found");
        }

        const prevStatus = order.orderStatus;

        if (
            (status === "Cancelled" || status === "Returned") &&
            (prevStatus !== "Cancelled" && prevStatus !== "Returned")
        ) {
            for (let item of order.items) {
                const stockKey = `variants.${item.variantIndex}.quantity`;
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { [stockKey]: item.quantity } }
                );
            }
        }


        order.orderStatus = status;

        order.items.forEach(item => {
            if (item.itemStatus !== "Cancelled") {
                item.itemStatus = status;
            }
        });

        await order.save();
        res.redirect(`/admin/orders/${orderId}`);

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
}

const approveReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const item = order.items.id(itemId);
        if (!item || item.itemStatus !== "Return Requested") {
            return res.status(400).json({ success: false, message: "Invalid item for return" });
        }

        const itemOriginalTotal = Number(item.price) || 0;
        const orderSubtotal = Number(order.subtotal) || 0;
        const totalDiscountReceived = Number(order.discount) || 0;

        let refundAmount = itemOriginalTotal;

        if (orderSubtotal > 0 && totalDiscountReceived > 0) {
            const itemDiscountShare = (itemOriginalTotal / orderSubtotal) * totalDiscountReceived;
            refundAmount = Math.round(itemOriginalTotal - itemDiscountShare);
        }

        item.itemStatus = "Returned";

        const allReturned = order.items.every(i => ["Returned", "Cancelled"].includes(i.itemStatus));
        if (allReturned) {
            order.orderStatus = "Returned";
        }

        order.totalAmount = Math.max(0, (Number(order.totalAmount) || 0) - refundAmount);

        await Product.updateOne(
            { _id: item.productId, "variants._id": item.variantId },
            { $inc: { "variants.$.quantity": item.quantity } }
        );


        let wallet = await Wallet.findOne({ userId: order.userId });
        if (!wallet) {
            wallet = new Wallet({ userId: order.userId, balance: 0, transactions: [] });
        }

        wallet.balance += refundAmount;

        wallet.transactions.push({
            transactionType: "credit",
            amount: refundAmount,
            source: "order_return",
            status: "success",
            orderId: order._id,
            description: `Refund for returned item: ${item.name} (Discount applied)`
        });

        await wallet.save();
        await order.save();

        res.redirect(`/admin/orders/${orderId}`);

    } catch (error) {
        console.error("Approve Return Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const rejectReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const item = order.items.id(itemId);
        if (!item || item.itemStatus !== "Return Requested") {
            return res.status(400).json({ success: false, message: "Invalid return request" });
        }

        item.itemStatus = "delivered";

        const anyRequested = order.items.some(i => i.itemStatus === "Return Requested");
        const allReturned = order.items.every(i => ["Returned", "Cancelled"].includes(i.itemStatus));

        if (allReturned) {
            order.orderStatus = "Returned";
        } else if (anyRequested) {
            order.orderStatus = "Return Requested";
        } else {
            order.orderStatus = "delivered";
        }

        await order.save()

        res.redirect(`/admin/orders/${orderId}`);

    } catch (error) {
        console.error("Reject Return Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

export {
    loadOrders,
    loadordersdetails,
    updateOrderStatus,
    approveReturn,
    rejectReturn
};