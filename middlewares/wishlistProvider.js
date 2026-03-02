import Wishlist from "../models/wishlistSchema.js";

const wishlistProvider = async (req, res, next) => {
    try {
        if (req.session.user) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user });
            res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
        } else {
            res.locals.wishlistCount = 0;
        }
        next();
    } catch (error) {
        console.error("Wishlist Middleware Error:", error);
        res.locals.wishlistCount = 0;
        next();
    }
};

export { wishlistProvider};


