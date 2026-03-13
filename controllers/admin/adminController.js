import User from "../../models/userSchema.js";
import Order from "../../models/orderSchema.js";
import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";
import PDFDocument from "pdfkit";
import bcrypt from "bcrypt";


const loadLoginPage = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect("/admin/dashboard");
        }
        res.render("admin/adminLogin", { error: null });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};
``

//login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.render("admin/adminLogin", {
                error: "Admin not found",
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render("admin/adminLogin", {
                error: "Invalid email or password",
            });
        }

        req.session.admin = {
            _id: admin._id,
            email: admin.email,
            isAdmin: true,
        };

        return res.redirect("/admin/dashboard");
    } catch (error) {
        console.log("Admin login error:", error);
        res.status(500).send("Server Error");
    }
};


const logout = (req, res) => {
    delete req.session.admin;
    res.clearCookie("LuxuryTime.admin.sid");
    res.redirect("/admin");
};

//load dash
const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) return res.redirect("/admin");

        const totalUsers = await User.countDocuments({ isAdmin: false });
        const totalOrders = await Order.countDocuments();
        const revenueData = await Order.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'fullname');


        const statusCounts = await Order.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        const salesOverTime = await Order.aggregate([
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%b %d", date: "$createdAt" } },
                    dailyRevenue: { $sum: "$totalAmount" }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.render("admin/dashboard", {
            admin: req.session.admin,
            totalUsers,
            totalOrders,
            totalRevenue,
            recentOrders,
            statusCounts: JSON.stringify(statusCounts),
            salesOverTime: JSON.stringify(salesOverTime),
            activePage: "dashboard",
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};
//user data
const loadUsers = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin");
        }

        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;


        const query = {
            isAdmin: false,
            fullname: { $regex: search, $options: "i" }
        };


        const [users, totalUsers] = await Promise.all([
            User.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render("admin/userlist", {
            users,
            admin: req.session.admin,
            currentPage: page,
            totalPages,
            totalUsers,
            search,
            activePage: "customers",
        });

    } catch (error) {
        console.error("Load Users Error:", error);
        res.status(500).send("Server Error");
    }
};



const toggleUserStatus = async (req, res) => {
    try {

        const userId = req.params.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false });
        }


        user.isBlocked = !user.isBlocked;
        user.status = user.isBlocked ? "Blocked" : "Active";
        await user.save();


        res.json({
            success: true,
            isBlocked: user.isBlocked,
            status: user.status,
        });
    } catch (error) {
        console.error("Toggle user error:", error);
        res.status(500).json({ success: false });
    }
};


const loadproduct = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;

        const limit = 3;
        const skip = (page - 1) * limit;
        const sort = req.query.sort || "new";

        let filter = { isDeleted: false };
        let sortOption = { createdAt: -1 };

        if (search.trim() !== "") {
            filter.name = { $regex: search, $options: "i" };
        }

        if (sort === "old") {
            sortOption = { createdAt: 1 };
        }

        const totalProducts = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .populate("category")
            .sort(sortOption)
            .skip(skip)
            .limit(limit);


        res.render("admin/product", {
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            search,
            sort,
        });

    } catch (error) {
        console.error("Admin product load error:", error);
        res.status(500).send("Server error");
    }
};



const loadaddproduct = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        res.render("admin/addproduct", { categories, error: null });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};


const loadSalesReport = async (req, res) => {
    try {
        const { range, start, end } = req.query;
        
        let queryCondition = { 
            orderStatus: { $in: ['delivered', 'pending'] } 
        };
        
        const currentRange = range || 'today';
        let startDate, endDate;
        const now = new Date();

        if (currentRange === 'today') {
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
        } else if (currentRange === 'weekly') {
            const tempDate = new Date();
            startDate = new Date(tempDate.setDate(tempDate.getDate() - tempDate.getDay()));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
        } else if (currentRange === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
        } else if (currentRange === 'yearly') {
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
        } else if (currentRange === 'custom' && start && end) {
            startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
        }

        if (currentRange !== 'all' && startDate && endDate) {
            queryCondition.createdAt = { $gte: startDate, $lte: endDate };
        }

        const orders = await Order.find(queryCondition)
            .populate('userId')
            .sort({ createdAt: -1 });

            console.log(orders)
            
        const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

        const data = {
            adminName: req.session.admin ? req.session.admin.name : "Admin",
            filter: currentRange,
            startDate: start || '',
            endDate: end || '',
            stats: {
                totalRevenue,
                totalOrders: orders.length,
                avgOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
                newCustomers: 0,
                totalDiscount
            },
            recentOrders: orders.map(order => ({
                id: order._id.toString().slice(-6).toUpperCase(),
                date: order.createdAt,
                customer: order.userId ? (order.userId.fullname || order.userId.name || "Customer") : "Guest",
                status: order.orderStatus,
                amount: order.totalAmount,
            }))
        };

        res.render('admin/saleReport', { data });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Server Error");
    }
};


const downloadSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, range } = req.query;

        let start = new Date();
        let end = new Date();


        if (range === 'all') {
            start = new Date(0); 
            end = new Date();
        } else if (range === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
        }

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            orderStatus: { $in: ["delivered", "pending"] } 
        }).populate("userId").sort({ createdAt: -1 });


        const doc = new PDFDocument({ margin: 30, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=LuxuryTime_Sales_Report.pdf`);
        doc.pipe(res);


        doc.rect(0, 0, 612, 100).fill("#0a0a0a"); 
        doc.fillColor("#d4af37").fontSize(26).font("Helvetica-Bold").text("LUXURY TIME", 40, 35); 
        doc.fillColor("#ffffff").fontSize(10).font("Helvetica").text("PREMIUM SALES AUDIT REPORT", 40, 65);
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 450, 65);


        const stats = orders.reduce((acc, o) => {
            acc.total += (o.totalAmount || 0);
            acc.discount += (o.discount || 0);
            return acc;
        }, { total: 0, discount: 0 });


        doc.fillColor("#1a1a1a").fontSize(14).font("Helvetica-Bold").text("Executive Summary", 40, 120);
        doc.rect(40, 140, 530, 60).fill("#f4f4f4").stroke("#d4af37");
        
        doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold");
        doc.text(`Total Orders: ${orders.length}`, 60, 155);
        doc.text(`Total Discounts: INR ${stats.discount.toLocaleString('en-IN')}`, 60, 175);
        
        doc.fontSize(12).text(`Total Net Revenue:`, 340, 155);
        doc.fillColor("#b8860b").fontSize(16).text(`INR ${stats.total.toLocaleString('en-IN')}`, 340, 175);


        const tableTop = 230;
        doc.rect(40, tableTop, 530, 20).fill("#1a1a1a");
        doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");


        doc.text("DATE", 45, tableTop + 6);
        doc.text("ORDER ID", 100, tableTop + 6);
        doc.text("CUSTOMER", 190, tableTop + 6);
        doc.text("STATUS", 330, tableTop + 6);
        doc.text("DISC.", 420, tableTop + 6);
        doc.text("FINAL AMOUNT", 480, tableTop + 6, { align: "right" });

        let currentRowY = tableTop + 25;
        doc.font("Helvetica").fontSize(8);

        
        orders.forEach((order, i) => {

            if (currentRowY > 750) {
                doc.addPage();
                currentRowY = 50;
            }


            if (i % 2 === 0) doc.rect(40, currentRowY - 5, 530, 20).fill("#fafafa");
            
            doc.fillColor("#333333");
            

            const dateStr = order.createdAt ? order.createdAt.toLocaleDateString('en-IN') : "N/A";
            doc.text(dateStr, 45, currentRowY);


            const idStr = order._id ? order._id.toString().slice(-10).toUpperCase() : "N/A";
            doc.text(idStr, 100, currentRowY);


            const customerName = order.userId ? (order.userId.fullname || order.userId.name || "Guest") : "Guest";
            doc.text(customerName.substring(0, 22), 190, currentRowY);


            const status = (order.orderStatus || "N/A").toUpperCase();
            doc.text(status, 330, currentRowY);


            const discount = order.discount || 0;
            doc.text(`- ${discount}`, 420, currentRowY);
            

            doc.fillColor("#000000").font("Helvetica-Bold");
            const total = (order.totalAmount || 0).toLocaleString('en-IN');
            doc.text(`INR ${total}`, 480, currentRowY, { align: "right" });
            
            currentRowY += 22;
        });

        doc.end();

    } catch (error) {
        console.error("PDF Download Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

// EXPORTS
export {
    loadLoginPage,
    login,
    logout,
    loadDashboard,
    loadUsers,
    toggleUserStatus,
    loadproduct,
    loadaddproduct,
    loadSalesReport,
    downloadSalesReport
};