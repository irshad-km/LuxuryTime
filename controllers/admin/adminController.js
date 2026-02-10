import User from "../../models/userSchema.js";
import Category from "../../models/categorySchema.js";
import Product from "../../models/productSchema.js";
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


//load dash
const loadDashboard = async (req, res) => {
    try {
        
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

// EXPORTS
export {
    loadLoginPage,
    login,
    logout,
    loadDashboard,
    loadUsers,
    toggleUserStatus,
    loadproduct,
    loadaddproduct

};