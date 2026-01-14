
import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";

/* ===============================
    LOAD ADMIN LOGIN PAGE
================================ */
const loadLoginPage = async (req, res) => {
    try {
        // If already logged in, go to dashboard
        if (req.session.adminId) {
            return res.redirect("/admin/dashboard");
        }
        res.render("admin/adminLogin", { error: null });
    } catch (error) {
        console.error("Load Login Page Error:", error);
        res.status(500).send("Server Error");
    }
};

/* ===============================
    ADMIN LOGIN
================================ */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user who is marked as admin
        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.render("admin/adminLogin", {
                error: "Invalid email or password",
            });
        }

        // Secure password comparison
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render("admin/adminLogin", {
                error: "Invalid email or password",
            });
        }

        // Initialize session
        req.session.adminId = admin._id;
        res.redirect("/admin/dashboard");

    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).send("Server Error");
    }
};

/* ===============================
    LOAD DASHBOARD
================================ */
const loadDashboard = async (req, res) => {
    try {
        // Fetch admin details and total count in parallel for better performance
        const [admin, totalUsers] = await Promise.all([
            User.findById(req.session.adminId),
            User.countDocuments({ isAdmin: false })
        ]);

        if (!admin) return res.redirect("/admin/login");

        res.render("admin/dashboard", {
            admin,
            totalUsers,
            activePage: "dashboard" // Used to highlight 'Dashboard' in sidebar
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).send("Server Error");
    }
};

/* ===============================
    LOAD USER LIST (Customer Management)
================================ */
// adminController.js
const loadUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || "";

        const query = {
            isAdmin: false,
            $or: [
                { fullname: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } },
                { phone: { $regex: searchQuery, $options: "i" } }
            ]
        };

        const [users, totalUsers, admin] = await Promise.all([
            User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
            User.countDocuments(query),
            User.findById(req.session.adminId)
        ]);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render("admin/userlist", {
            users,
            admin,
            currentPage: page,
            totalPages,
            totalUsers,
            search: searchQuery,
            activePage: "customers"
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

        // Toggle block
        user.isBlocked = !user.isBlocked;
        user.status = user.isBlocked ? "Blocked" : "Active";
        await user.save();

        // 🔥 DESTROY USER SESSION IF BLOCKED
        if (user.isBlocked && req.sessionStore) {
            req.sessionStore.all((err, sessions) => {
                if (err) return;

                for (let sid in sessions) {
                    const sess = sessions[sid];

                    if (sess.user?._id?.toString() === userId.toString()) {
                        req.sessionStore.destroy(sid, () => { });
                    }
                }
            });
        }

        res.json({
            success: true,
            isBlocked: user.isBlocked,
            status: user.status
        });

    } catch (error) {
        console.error("Toggle user error:", error);
        res.status(500).json({ success: false });
    }
};



export {
    loadLoginPage,
    login,
    loadDashboard,
    loadUsers,
    toggleUserStatus
};