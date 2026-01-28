import User from "../models/userSchema.js";


const requireAdminLogin = async (req, res, next) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin");
        }

        const admin = await User.findById(req.session.admin);

        if (!admin || !admin.isAdmin) {
            delete req.session.admin;
            return res.redirect("/admin");
        }

        next();
    } catch (error) {
        console.log("Admin auth error:", error);
        res.redirect("/admin");
    }
};


const checkUserBlocked = async (req, res, next) => {
    try {
        if (!req.session.user) return next()

        const user = await User.findById(req.session.user._id);

        if (!user || user.isBlocked) {
            delete req.session.user;
            res.clearCookie("LuxuryTime.user.sid");
            return res.redirect("/login");
        }

        next();

    } catch (error) {
        console.log("checkUserBlocked error:", error);
        res.redirect("/login");
    }
};


const requireAdminLoginSimple = (req, res, next) => {
    if (!req.session.admin || !req.session.admin.isAdmin) {
        return res.redirect("/admin");
    }
    next();
};


const guestOnly = (req, res, next) => {
    if (req.session.admin) {
        return res.redirect("/admin/dashboard");
    }
    next();
};


export {
    requireAdminLogin,
    guestOnly,
    requireAdminLoginSimple,
    checkUserBlocked,
};