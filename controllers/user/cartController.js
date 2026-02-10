import Cart from "../../models/cartSchema.js";
import Product from "../../models/productSchema.js";

const loadcart = async (req, res) => {
    try {
        const userId = req.session.user?._id; 
        if (!userId) {
            return res.redirect("/login"); 
        }

        let cart = await Cart.findOne({ user: userId })
            .populate("items.product")
            .lean();

        if (cart && cart.items.length > 0) {
            cart.items = cart.items
                .map(item => {
                    if (!item.product) return null; 
                    const variant = item.product.variants?.[item.variantIndex];
                    if (!variant) return null; 

                    return {
                        ...item,
                        selectedVariant: variant
                    };
                })
                .filter(Boolean); 
        }

        if (cart?.items?.length) {
            console.log(cart.items[0].selectedVariant);
        }

        res.render("user/cart", {
            cart,
            user: req.session.user,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send("Error loading cart");
    }
}


const addToCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.params;
        const { variantIndex } = req.body;

        const product = await Product.findById(productId);
        
        if (!product) {
            return res.redirect("/")
        }

        if (
            variantIndex === undefined ||
            variantIndex < 0 ||
            variantIndex >= product.variants.length
        ) {
            return res.status(400).send("Invalid variant");
        }

        const variant = product.variants[variantIndex];

        if (variant.stock < 1) {
            return res.status(400).send("Out of stock");
        }

        const price = variant.salePrice || variant.regularPrice;

        let cart = await Cart.findOne({ user: userId })

        if (!cart) {
            cart = new Cart({
                user: userId,
                items: [{
                    product: productId,
                    variantIndex: Number(variantIndex),
                    price,
                    quantity: 1,
                    totalPrice: price,
                }],
                grandTotal: price,
            });
        } else {
            const itemIndex = cart.items.findIndex(
                (item) =>
                    item.product.toString() === productId &&
                    item.variantIndex === Number(variantIndex)
            );

            if (itemIndex > -1) {
                if (cart.items[itemIndex].quantity + 1 > variant.stock) {
                    return res.status(400).send("Stock limit exceeded");
                }

                cart.items[itemIndex].quantity += 1;
                cart.items[itemIndex].totalPrice =
                    cart.items[itemIndex].quantity * cart.items[itemIndex].price;
            } else {
                cart.items.push({
                    product: productId,
                    variantIndex: Number(variantIndex),
                    price,
                    quantity: 1,
                    totalPrice: price,
                });
            }

            cart.grandTotal = cart.items.reduce(
                (sum, item) => sum + item.totalPrice,
                0
            );
        }

        await cart.save()
        res.redirect("/cart");

    } catch (error) {
        console.log(error);
        res.status(500).send("Server error");
    }
}


const removeFromCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login"); 
        }

        const userId = req.session.user._id;
        const productId = req.params.productId;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.redirect("/cart");

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== productId
        );

        cart.grandTotal = cart.items.reduce(
            (sum, item) => sum + item.totalPrice,
            0
        );

        await cart.save();
        res.redirect("/cart");

    } catch (error) {
        console.log(error);
        res.status(500).send("Server error");
    }
};


export {
    loadcart,
    addToCart,
    removeFromCart
}