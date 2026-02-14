import Cart from "../models/cartSchema.js";

const cartMiddleware = async (req, res, next) => {
    try {
        if (req.session.user) {
            const cart = await Cart.findOne({ user: req.session.user._id });

            const totalQty = cart?.items?.reduce((sum, item) => {
                return sum + item.quantity;
            }, 0) || 0;

            res.locals.cart = cart || { items: [] };
            res.locals.totalQty = totalQty;

        } else {
            res.locals.cart = { items: [] };
            res.locals.totalQty = 0;
        }

        next();
    } catch (err) {
        console.log(err);
        res.locals.cart = { items: [] };
        res.locals.totalQty = 0;
        next();
    }
};

export {
    cartMiddleware
};
