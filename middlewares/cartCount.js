import Cart from "../models/cartSchema.js";

 const cartMiddleware = async (req, res, next) => {
    try {
        if (req.session.user) {
            const cart = await Cart.findOne({ user: req.session.user._id });
            res.locals.cart = cart || { items: [] };
        } else {
            res.locals.cart = { items: [] };
        }
        next();
    } catch (err) {
        console.log(err);
        res.locals.cart = { items: [] };
        next();
    }
};


export {
    cartMiddleware
}