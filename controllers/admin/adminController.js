import User from "../../models/userSchema.js";
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

const login = async (req, res) => {
    try {
          
        const { email, password } = req.body;

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.render("admin/adminLogin", {
                error: "Invalid email or password",
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
        console.log("success work")

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


const loadDashboard = async (req, res) => {
    try {
        console.log("success")
        if (!req.session.admin) {
            return res.redirect("/admin");
        }
        const admin = await User.findById(req.session.admin._id);
        const totalUsers = await User.countDocuments({ isAdmin: false });

        res.render("admin/dashboard", {
            admin,
            totalUsers,
            activePage: "dashboard",
        });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};


const loadUsers = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin");
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || "";

        const query = {
            isAdmin: false,
            $or: [
                { fullname: { $regex: searchQuery, $options: "i" } },
                { email: { $regex: searchQuery, $options: "i" } },
                { phone: { $regex: searchQuery, $options: "i" } },
            ],
        };

        const [users, totalUsers] = await Promise.all([
            User.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),
            User.countDocuments(query),
        ]);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render("admin/userlist", {
            users,
            admin: req.session.admin,
            currentPage: page,
            totalPages,
            totalUsers,
            search: searchQuery,
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
            status: user.status,
        });
    } catch (error) {
        console.error("Toggle user error:", error);
        res.status(500).json({ success: false });
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
};