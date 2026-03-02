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
        const limit = 2;
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
        const totalOrders = await Order.countDocuments({ status: { $ne: 'Cancelled' } });

        const revenueData = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]);

        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
        
        const newCustomers = await User.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
        });

        const recentOrdersRaw = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'fullname');


            const recentOrders = recentOrdersRaw.map(order => ({
            id: order._id.toString().slice(-8).toUpperCase(), 
            date: order.createdAt.toLocaleDateString('en-IN'),
            customer: order.userId ? order.userId.fullname : 'Guest Customer',
            status: order.status || order.orderStatus, 
            amount: order.totalAmount.toLocaleString('en-IN')
        }));

        const data = {
            adminName: req.session.admin ? req.session.admin.name : "Admin",
            stats: {
                totalRevenue: totalRevenue.toLocaleString('en-IN'),
                totalOrders: totalOrders,
                avgOrderValue: avgOrderValue.toLocaleString('en-IN'),
                newCustomers: newCustomers
            },
            recentOrders: recentOrders
        };

        res.render('admin/saleReport', { data });

    } catch (error) {
        console.error("Error loading sales report:", error);
        res.status(500).send("Internal Server Error");
    }
};


const downloadSalesReport = async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate } = req.query;

        let start = new Date();
        let end = new Date();

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            start.setDate(start.getDate() - 30);
        }

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            status: { $ne: "Cancelled" }
        }).populate("userId").sort({ createdAt: -1 });

        
        if (format === "excel") {
            const workbook = new excelJS.Workbook();
            const worksheet = workbook.addWorksheet("Sales Report");

            worksheet.columns = [
                { header: "Order ID", key: "id", width: 25 },
                { header: "Date", key: "date", width: 15 },
                { header: "Customer", key: "customer", width: 25 },
                { header: "Status", key: "status", width: 15 },
                { header: "Amount (INR)", key: "amount", width: 15 }
            ];

            worksheet.getRow(1).font = { bold: true };

            orders.forEach(o => {
                
                const orderAmount = o.totalAmount || o.finalAmount || 0;
                
                worksheet.addRow({
                    id: o._id ? o._id.toString() : "N/A",
                    date: o.createdAt ? o.createdAt.toLocaleDateString('en-IN') : "N/A",
                    customer: o.userId ? o.userId.fullname : "Guest Customer",
                    status: o.status || o.orderStatus || "N/A",
                    amount: orderAmount
                });
            });

            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename=LuxuryTime_Report.xlsx`);
            return await workbook.xlsx.write(res);
        }

        
        if (format === "pdf") {
            const doc = new PDFDocument({ margin: 40, size: "A4" });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=LuxuryTime_Report.pdf`);
            doc.pipe(res);

            
            doc.rect(0, 0, 612, 100).fill("#1a1a1a");
            doc.fillColor("#ffffff").fontSize(24).font("Helvetica-Bold").text("LUXURY TIME", 40, 35);
            doc.fontSize(10).font("Helvetica").text("OFFICIAL SALES REPORT", 40, 65);

            
            const totalRevenue = orders.reduce((sum, o) => {
                const val = o.totalAmount || o.finalAmount || 0;
                return sum + val;
            }, 0);
            
            
            doc.fillColor("#333333").fontSize(12).font("Helvetica-Bold").text("Executive Summary", 40, 120);
            doc.rect(40, 140, 520, 50).fill("#f9f9f9").stroke("#e0e0e0");
            doc.fillColor("#000000").fontSize(11).text(`Total Orders: ${orders.length}`, 60, 160);
            doc.text(`Total Revenue: INR ${totalRevenue.toLocaleString('en-IN')}`, 350, 160);

            
            const tableTop = 220;
            doc.fillColor("#333333").fontSize(10).font("Helvetica-Bold");
            doc.text("Date", 40, tableTop);
            doc.text("Order ID", 120, tableTop);
            doc.text("Customer", 250, tableTop);
            doc.text("Amount", 500, tableTop, { align: "right" });
            doc.moveTo(40, tableTop + 15).lineTo(560, tableTop + 15).stroke();

            
            let currentRowY = tableTop + 25;
            doc.font("Helvetica").fontSize(9);

            orders.forEach((order, i) => {
                if (currentRowY > 750) {
                    doc.addPage();
                    currentRowY = 50;
                }

                const displayAmount = order.totalAmount || order.finalAmount || 0;

                if (i % 2 === 0) doc.rect(40, currentRowY - 5, 520, 20).fill("#f6f6f6");
                
                doc.fillColor("#444444");
                doc.text(order.createdAt ? order.createdAt.toLocaleDateString('en-IN') : "N/A", 40, currentRowY);
                doc.text(order._id ? order._id.toString().slice(-10).toUpperCase() : "N/A", 120, currentRowY);
                doc.text(order.userId ? (order.userId.fullname || "User") : "Guest", 250, currentRowY);
                
                doc.fillColor("#000000").font("Helvetica-Bold");
                doc.text(`INR ${Number(displayAmount).toLocaleString('en-IN')}`, 500, currentRowY, { align: "right" });
                doc.font("Helvetica");

                currentRowY += 25;
            });

            doc.end();
        }
    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).send("Error generating report");
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