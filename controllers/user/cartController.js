import Cart from "../../models/cartSchema.js";
import Product from "../../models/productSchema.js";
import Wishlist from "../../models/wishlistSchema.js";

const loadcart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect("/login");
        }

        let cart = await Cart.findOne({ user: userId })
            .populate({
                path: "items.product",
                populate: { path: "category" }
            });

        if (!cart) {
            return res.render("user/cart", {
                cart: null,
                totalQty: 0,
                removedMessages: [],
            });
        }

        let validItems = [];
        let subtotal = 0;
        let removedMessages = [];

        for (let item of cart.items) {
            if (!item.product) {
                removedMessages.push("A product was removed from your cart.");
                continue;
            }

            const product = item.product;
            const productName = product.name;

            if (product.isDeleted || !product.isListed || !product.category || !product.category.isListed) {
                removedMessages.push(`${productName} is currently unavailable.`);
                continue;
            }

            const variant = product.variants?.[item.variantIndex];
            if (!variant) {
                removedMessages.push(`${productName} variant is unavailable.`);
                continue;
            }

            if (variant.quantity <= 0) {
                removedMessages.push(`${productName} is out of stock.`);
                continue;
            }

            let finalQuantity = item.quantity;
            if (item.quantity > variant.quantity) {
                finalQuantity = variant.quantity;
                removedMessages.push(`${productName} quantity reduced to ${variant.quantity} due to stock update.`);
            }


            const reglPrice = variant.salePrice || 0;
            const variantOffer = variant.offer || 0;
            const categoryOffer = product.category?.offer || 0;
            const bestOffer = Math.max(variantOffer, categoryOffer);

            const latestPrice = Math.floor(reglPrice - (reglPrice * (bestOffer / 100)));

            if (!latestPrice || isNaN(latestPrice)) continue;

            const itemTotalPrice = latestPrice * finalQuantity;
            subtotal += itemTotalPrice;

            validItems.push({
                product: product._id,
                quantity: finalQuantity,
                variantIndex: item.variantIndex,
                price: latestPrice,
                totalPrice: itemTotalPrice
            });
        }

        cart.items = validItems;
        cart.subtotal = subtotal;
        cart.grandTotal = subtotal;

        cart.markModified('items');
        await cart.save();

        const updatedCart = await Cart.findOne({ user: userId })
            .populate({
                path: "items.product",
                populate: { path: "category" }
            })
            .lean();

        if (updatedCart && updatedCart.items.length > 0) {
            updatedCart.items = updatedCart.items.map(item => {
                const variant = item.product?.variants?.[item.variantIndex];

                const vOffer = variant?.offer || 0;
                const cOffer = item.product?.category?.offer || 0;
                const bOffer = Math.max(vOffer, cOffer);
                const finalPrice = Math.floor(variant.salePrice - (variant.salePrice * (bOffer / 100)));

                return {
                    ...item,
                    selectedVariant: variant,
                    calculatedPrice: finalPrice,
                    offerPercentage: bOffer
                };
            });
        }

        const totalQty = updatedCart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

        res.render("user/cart", {
            cart: updatedCart,
            totalQty,
            removedMessages
        });

    } catch (error) {
        console.error("Load Cart Error:", error);
        res.status(500).send("Internal Server Error");
    }
};




const addToCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false });
        }

        const { productId } = req.params;
        const { variantIndex } = req.body;


        const product = await Product.findById(productId).populate('category');

        if (!product || product.isDeleted || !product.isListed) {
            return res.status(404).json({ success: false, message: "Product is currently unavailable." });
        }

        if (!product.category || !product.category.isListed) {
            return res.status(400).json({ success: false, message: "Product category is hidden." });
        }

        const variant = product.variants?.[variantIndex];
        if (!variant || variant.quantity < 1) {
            return res.status(400).json({ success: false, message: "Out of stock" });
        }

        const price = variant.salePrice || variant.regularPrice;
        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(
            item => item.product.toString() === productId &&
                item.variantIndex === Number(variantIndex)
        );

        const currentQtyInCart = itemIndex > -1 ? cart.items[itemIndex].quantity : 0;
        const newTotalQty = currentQtyInCart + 1;

        if (newTotalQty > 4) {
            return res.json({
                success: false,
                message: "Luxury Policy: Maximum 4 units allowed per order."
            });
        }

        if (newTotalQty > variant.quantity) {
            return res.json({
                success: false,
                message: `Only ${variant.quantity} units available in stock.`
            });
        }

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = newTotalQty;
            cart.items[itemIndex].totalPrice = newTotalQty * cart.items[itemIndex].price;
        } else {
            cart.items.push({
                product: productId,
                variantIndex: Number(variantIndex),
                price,
                quantity: 1,
                totalPrice: price,
            });
        }

        cart.grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        await cart.save();

        const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);

        return res.json({
            success: true,
            totalQty,
            grandTotal: cart.grandTotal
        });

    } catch (error) {
        console.error("Add to Cart Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) return res.redirect("/login");

        const productId = req.params.productId;
        
        const cart = await Cart.findOne({ user: userId });

        if (!cart) return res.redirect("/cart");

        cart.items = cart.items.filter(
            (item) => item.product.toString() !== productId
        );

        cart.grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        await cart.save();
        res.redirect("/cart");

    } catch (error) {
        console.error("Remove Error:", error);
        res.status(500).send("Server error");
    }
};

const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Login required" });
        }

        const { productId } = req.params;
        const { variantIndex, action } = req.body;

        const cart = await Cart.findOne({ user: userId });
        const product = await Product.findById(productId);
        const variant = product?.variants[variantIndex];

        if (!cart || !variant) {
            return res.status(404).json({ success: false, message: "Item or Variant not found" });
        }

        const itemIndex = cart.items.findIndex(
            item => item.product.toString() === productId && item.variantIndex === Number(variantIndex)
        );

        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Item not in cart" });
        }

        let quantity = cart.items[itemIndex].quantity;
        const stock = variant.quantity;

        if (action === "increase") {
            if (quantity >= 4) {
                return res.json({ success: false, message: "Luxury Policy: Maximum 4 units allowed per order." });
            }
            if (quantity >= stock) {
                return res.json({ success: false, message: `Only ${stock} units available in stock.` });
            }
            quantity += 1;
        } else if (action === "decrease") {
            if (quantity > 1) {
                quantity -= 1;
            }
        }

        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].totalPrice = quantity * cart.items[itemIndex].price;
        cart.grandTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        let totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);


        await cart.save();

        res.json({
            success: true,
            newQty: quantity,
            totalQty,
            grandTotal: cart.grandTotal
        });

    } catch (error) {
        console.error("Update Qty Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const moveToCartFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        const { productId, variantId } = req.body;

        const product = await Product.findById(productId);

        if (!product || product.isDeleted) {
            return res.status(404).json({ success: false, message: "Product no longer available" });
        }

        if (product.isListed === false) {
            return res.status(400).json({ success: false, message: "This product is currently unavailable" });
        }

        let price = 0;
        let stockAvailable = 0;
        let vIndex = -1;


        if (variantId && variantId !== "" && variantId !== productId.toString()) {
            vIndex = product.variants.findIndex(v => v._id.toString() === variantId);
        }

        if (vIndex === -1 && product.variants.length > 0) {
            vIndex = 0;
        }

        if (vIndex !== -1 && product.variants[vIndex]) {
            const selectedVariant = product.variants[vIndex];

            price = Number(selectedVariant.salePrice) || Number(selectedVariant.regularPrice) || 0;
            stockAvailable = Number(selectedVariant.quantity) || 0;
        } else {
            return res.status(400).json({ success: false, message: "No valid variants found for this product" });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [], grandTotal: 0 });
        }

        const itemIndex = cart.items.findIndex(
            item => item.product.toString() === productId && item.variantIndex === vIndex
        );

        const currentQtyInCart = itemIndex > -1 ? cart.items[itemIndex].quantity : 0;
        const newTotalQty = currentQtyInCart + 1;

        if (newTotalQty > 4) {
            return res.json({ success: false, message: "Maximum 4 units allowed per order." });
        }
        if (newTotalQty > stockAvailable) {
            return res.json({ success: false, message: "Out of stock." });
        }

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity = newTotalQty;
            cart.items[itemIndex].totalPrice = newTotalQty * price;
        } else {
            cart.items.push({
                product: productId,
                variantIndex: vIndex,
                price: price,
                quantity: 1,
                totalPrice: price,
            });
        }

        cart.grandTotal = cart.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);

        await cart.save();

        await Wishlist.findOneAndUpdate(
            { userId: userId },
            {
                $pull: {
                    products: {
                        productId: productId,
                        variantId: variantId
                    }
                }
            }
        );

        return res.json({
            success: true,
            message: "Moved to cart",
            totalQty: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        });

    } catch (error) {
        console.error("Move to Cart Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export {
    loadcart,
    addToCart,
    removeFromCart,
    updateQuantity,
    moveToCartFromWishlist
}