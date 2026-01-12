import User from "../models/userSchema.js";

const requireLogin = async (req, res, next) => {
  try {
    const loggedUser = req.user || req.session.user;

    if (!loggedUser) {
      return res.redirect("/login");
    }

    const user = await User.findById(loggedUser._id || loggedUser.id);
    if (!user) {
      req.session.destroy(() => { });
      return res.redirect("/login");
    }

    res.locals.user = user;
    next();
  } catch (error) {
    console.log(error);
    return res.redirect("/login");
  }
};

const guestOnly = (req, res, next) => {
  if (req.session.user || req.user) {
    return res.redirect("/");
  }
  next();
};

export { requireLogin, guestOnly };
