import Order from "../../models/orderSchema.js";
import Product from "../../models/productSchema.js";
import User from "../../models/userSchema.js";
import Wallet from "../../models/walletSchema.js";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";




const loadOrders = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) return res.redirect("/login");

        const page = parseInt(req.query.page) || 1;
        const limit = 3;
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

        const user=await User.findById(userId)

        console.log(user)

        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate("items.productId")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalPages = Math.ceil(totalOrders / limit) || 1;

        return res.render("user/userOrder", {
            user:user,
            orders,
            currentPage: page,
            totalPages,
            search,
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



//getInvoice 
const getInvoice = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const orderId = req.params.id;

        if (!userId) return res.redirect("/login");

        const order = await Order.findOne({ _id: orderId, userId }).populate("items.productId");
        if (!order) return res.status(404).send("Order not found");


        const activeItems = order.items.filter(item => 
            item.itemStatus !== 'Cancelled' && 
            item.itemStatus !== 'Returned' && 
            item.itemStatus !== 'Return Requested'
        );


        const activeSubtotal = activeItems.reduce((sum, item) => {
            const itemPrice = item.finalPrice || item.price || 0; 
            return sum + (itemPrice * item.quantity);
        }, 0);
        
        const grandTotal = activeSubtotal + (order.shippingCharge || 0);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=INV-${order._id.toString().toUpperCase().slice(-6)}.pdf`);
        doc.pipe(res);


        doc.rect(0, 0, 595, 15).fill('#111111'); 
        doc.fillColor('#111111').fontSize(24).font('Helvetica-Bold').text("L U X U R Y", 0, 55, { align: 'center', characterSpacing: 8 });
        doc.fontSize(8).font('Helvetica').text("GENÈVE • LONDON • DUBAI", 0, 85, { align: 'center', characterSpacing: 3 });

        doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e5e7eb').lineWidth(0.5).stroke();


        let metaY = 135;
        doc.fillColor('#9ca3af').fontSize(7).text("ORDER REFERENCE", 50, metaY);
        doc.text("DATE OF PURCHASE", 0, metaY, { align: 'right' });

        metaY += 12;
        doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold').text(`#${order.orderId || order._id}`, 50, metaY);
        doc.text(new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), 0, metaY, { align: 'right' });


        let addrY = 180;
        doc.fillColor('#9ca3af').fontSize(7).font('Helvetica').text("SHIPPING DESTINATION", 50, addrY);
        
        addrY += 12;
        const addr = order.address || {};
        doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold').text((addr.fullname || "Customer").toUpperCase(), 50, addrY);
        doc.fontSize(8).font('Helvetica').fillColor('#4b5563');
        doc.text(`${addr.city || ''}, ${addr.state || ''}`, 50, addrY + 12);
        doc.text(`ZIP: ${addr.pincode || ''} | TEL: ${addr.phone || ''}`, 50, addrY + 24);


        let tableY = 250;
        doc.moveTo(50, tableY).lineTo(545, tableY).strokeColor('#111111').lineWidth(0.8).stroke();
        doc.fillColor('#111111').fontSize(8).font('Helvetica-Bold').text("DESCRIPTION", 60, tableY + 10);
        doc.text("QTY", 320, tableY + 10, { width: 50, align: 'center' });
        doc.text("PRICE", 380, tableY + 10, { width: 80, align: 'right' });
        doc.text("TOTAL", 470, tableY + 10, { width: 75, align: 'right' });

        doc.moveTo(50, tableY + 28).lineTo(545, tableY + 28).strokeColor('#e5e7eb').lineWidth(0.5).stroke();


        let itemY = tableY + 40;

        if (activeItems.length === 0) {
            doc.fillColor('#9ca3af').fontSize(10).font('Helvetica-Oblique').text("No active products available in this invoice.", 60, itemY);
            itemY += 40;
        } else {
            activeItems.forEach((item) => {
                const name = item.name || (item.productId ? item.productId.productName : "EXCLUSIVÉ TIMEPIECE");
                const price = item.finalPrice || item.price || 0; // Safety Check
                
                doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold').text(name.toUpperCase(), 60, itemY);
                doc.fontSize(7).font('Helvetica').fillColor('#9ca3af').text("SWISS MADE CERTIFIED", 60, itemY + 10);
                
                doc.fillColor('#111111').fontSize(9).text(item.quantity.toString(), 320, itemY, { width: 50, align: 'center' });
                doc.text(`₹ ${price.toLocaleString()}`, 380, itemY, { width: 80, align: 'right' });
                doc.font('Helvetica-Bold').text(`₹ ${(price * item.quantity).toLocaleString()}`, 470, itemY, { width: 75, align: 'right' });
                
                itemY += 40;
                doc.moveTo(60, itemY - 10).lineTo(545, itemY - 10).strokeColor('#f3f4f6').lineWidth(0.5).stroke();
            });
        }


        let summaryY = Math.max(itemY + 10, 600); 
        doc.fillColor('#9ca3af').fontSize(8).font('Helvetica').text("SUBTOTAL", 350, summaryY);
        doc.fillColor('#111111').text(`₹ ${(activeSubtotal || 0).toLocaleString()}`, 470, summaryY, { align: 'right', width: 75 });

        summaryY += 18;
        doc.fillColor('#9ca3af').text("SHIPPING", 350, summaryY);
        const shippingText = (order.shippingCharge && order.shippingCharge > 0) ? `₹ ${order.shippingCharge.toLocaleString()}` : "COMPLIMENTARY";
        doc.fillColor('#111111').text(shippingText, 445, summaryY, { align: 'right', width: 100 });

        summaryY += 25;
        doc.rect(340, summaryY - 8, 215, 35).fill('#f9fafb');
        doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold').text("GRAND TOTAL", 350, summaryY + 5);
        doc.fontSize(12).text(`₹ ${(grandTotal || 0).toLocaleString()}`, 445, summaryY + 3, { align: 'right', width: 100 });

        const footerY = 770;
        doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.fillColor('#111111').fontSize(8).font('Helvetica-Bold').text("THANK YOU FOR YOUR PATRONAGE.", 0, footerY + 15, { align: 'center' });
        doc.fillColor('#9ca3af').fontSize(7).font('Helvetica').text("OFFICIAL PURCHASE CERTIFICATE • LUXURY WATCHES GROUP", 0, footerY + 28, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error("Invoice Generation Error:", error);
        res.status(500).send("Error generating invoice");
    }
};

const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const orderId = req.params.id;
        const { itemId } = req.body;

        const order = await Order.findOne({ _id: orderId, userId })
            .populate("items.productId");

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const item = order.items.find(i => i._id.toString() === itemId);

        if (!item) return res.status(404).json({ success: false, message: "Item not found" });

        if (item.itemStatus === "Cancelled") {
            return res.status(400).json({ success: false, message: "Item already cancelled" });
        }

        const itemOriginalTotal = Number(item.price) || 0;
        const orderSubtotal = Number(order.subtotal) || 0;
        const totalDiscountReceived = Number(order.discount) || 0;

        let refundAmount = itemOriginalTotal;


        if (orderSubtotal > 0 && totalDiscountReceived > 0) {
            const itemDiscountShare = (itemOriginalTotal / orderSubtotal) * totalDiscountReceived;
            refundAmount = itemOriginalTotal - itemDiscountShare
        }

        console.log(refundAmount)

        

        await Product.updateOne(
    { 
        _id: item.productId._id,
        "variants._id": item.variantId   
    },
    { 
        $inc: { "variants.$.quantity": item.quantity }
    }
);

        const currentTotal = Number(order.totalAmount) || 0;
        order.totalAmount = Math.max(0, currentTotal - refundAmount);

        console.log(order.totalAmount)

        item.itemStatus = "Cancelled";

        const allCancelled = order.items.every(i => i.itemStatus === "Cancelled");
        if (allCancelled) {
            order.orderStatus = "Cancelled";
        }

        await order.save();

        if (order.paymentMethod === "ONLINE" || order.paymentMethod ==="Wallet") {
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = new Wallet({ userId, balance: 0, transactions: [] });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                transactionType: "credit",
                amount: refundAmount,
                source: "order_cancel",
                status: "success",
                orderId: order._id,
                description: `Refund for cancelled item: ${item.name}`
            });

            await wallet.save();
        }

        res.json({ success: true, refundAmount });

    } catch (error) {
        console.error("Cancel Order Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};



export {
    loadOrders,
    loadTrackOrders,
    requestReturn,
    requestReturnAll,
    getInvoice,
    cancelOrder
}


