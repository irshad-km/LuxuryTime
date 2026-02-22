import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import User from "../../models/userSchema.js";
import mongoose from "mongoose";


const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) return res.redirect("/login");

        const page = parseInt(req.query.page) || 1;
        const limit = 1; 
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        let query = { userId: userId };
        
        if (search) {
            let searchConditions = [
                { orderStatus: { $regex: search, $options: "i" } },
                { paymentMethod: { $regex: search, $options: "i" } }
            ];

            if (mongoose.Types.ObjectId.isValid(search)) {
                searchConditions.push({ _id: search });
            }

            query.$or = searchConditions;
        }

        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate("items.productId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalPages = Math.ceil(totalOrders / limit) || 1;

        return res.render("user/userOrder", {
            orders,
            currentPage: page,
            totalPages,
            search,
            user: req.session.user 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

const loadTrackOrders = async (req, res) => {
    try {

        const orderId = req.params.id;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect("/login");
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render("404", { message: "Invalid Order ID" });
        }

        const userData = await User.findById(userId);

        const orderData = await Order.findOne({
            _id: orderId,
            userId: userId
        });

        if (!orderData) {
            return res.status(404).render("404", { message: "Order not found" });
        }

        const formattedItems = orderData.items.map(item => ({
            ...item.toObject(),
            image: item.images?.[0] || "/images/default-product.png"
        }));

        res.render("user/trackOrder", {
            user: {
                name: userData.name,
                avatar: userData.avatar || "/images/default-avatar.png",
                membership: userData.membership || "Standard Member"
            },
            order: {
                _id: orderData._id,
                displayId: orderData._id.toString().toUpperCase().slice(-10),
                createdAt: orderData.createdAt,
                status: orderData.orderStatus || "Ordered",
                paymentMethod: orderData.paymentMethod,
                paymentStatus: orderData.paymentStatus,
                orderStatus: orderData.orderStatus,
                totalAmount: orderData.totalAmount,
                items: formattedItems
            }
        });

    } catch (error) {
        console.error("Error loading track order:", error);
        res.status(500).send("Internal Server Error");
    }
};


const requestReturn = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user ? req.session.user._id : null;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User session expired" });
        }


        const updatedOrder = await Order.findOneAndUpdate(
            {
                _id: orderId,
                userId: userId,
                orderStatus: "delivered",
                "items._id": itemId
            },
            {
                $set: {
                    "items.$.itemStatus": "Return Requested",
                    "items.$.returnReason": reason,
                    "items.$.returnedAt": new Date()
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found, not delivered, or item missing"
            });
        }

        res.status(200).json({
            success: true,
            message: "Return request submitted successfully"
        });

    } catch (error) {
        console.error("Return Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const requestReturnAll = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== "delivered") {
            return res.status(400).json({
                success: false,
                message: "Order must be in delivered status to request a return"
            });
        }

        let updated = false;

        order.items.forEach(item => {
            if (item.itemStatus && item.itemStatus.toLowerCase() === "delivered") {
                item.itemStatus = "Return Requested";
                item.returnReason = reason || "No reason provided";
                item.returnedAt = new Date();
                updated = true;
            }
        });

        if (!updated) {
            return res.status(400).json({
                success: false,
                message: "No eligible delivered items found to return"
            });
        }

        order.orderStatus = "Return Requested";

        await order.save();

        return res.json({
            success: true,
            message: "Return request submitted for all items"
        });

    } catch (error) {
        console.error("Return All Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}


export {
    loadOrders,
    loadTrackOrders,
    requestReturn,
    requestReturnAll
}


