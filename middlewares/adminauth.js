import User from "../models/userSchema.js";



 const requireAdminLogin = (req, res, next) => {
  if (!req.session.adminId) {
    return res.redirect("/admin/login");
  }
  next();
};


const guestOnly = (req, res, next) => {
  if (req.session.user || req.user) {
    return res.redirect("/");
  }
  next();
};



export {guestOnly,requireAdminLogin}