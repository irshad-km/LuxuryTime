import Cart from "../../models/cartSchema.js";
import Product from "../../models/productSchema.js";

const loadcart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect("/login");
        }

        let cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        if (!cart) {
            return res.render("user/cart", {
                cart: null,
                removedMessages: []
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

            const productName = item.product.name;

            if (item.product.isDeleted || !item.product.isListed) {
                removedMessages.push(`${productName} is currently unavailable.`);
                continue;
            }

            const variant = item.product.variants?.[item.variantIndex];
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

                removedMessages.push(
                    `${productName} quantity reduced to ${variant.quantity} due to stock update.`
                );
            }

            const latestPrice = Number(variant.salePrice || variant.price || 0);
            if (!latestPrice || isNaN(latestPrice)) continue;

            if (item.price !== latestPrice) {
                removedMessages.push(
                    `${productName} price updated from ₹${item.price} to ₹${latestPrice}.`
                );
            }

            const totalPrice = latestPrice * finalQuantity;
            subtotal += totalPrice;

            validItems.push({
                product: item.product._id,
                quantity: finalQuantity,
                variantIndex: item.variantIndex,
                price: latestPrice,
                totalPrice: totalPrice
            });
        }

        cart.items = validItems;
        cart.subtotal = subtotal;
        cart.grandTotal = subtotal;

        await cart.save();

        cart = await Cart.findOne({ user: userId })
            .populate("items.product")
            .lean();

        if (cart && cart.items.length > 0) {
            cart.items = cart.items.map(item => {
                const variant = item.product?.variants?.[item.variantIndex];
                return {
                    ...item,
                    selectedVariant: variant
                };
            });
        }

        const totalQty = cart?.items?.reduce((sum, item) => {
            return sum + item.quantity;
        }, 0) || 0;

        res.render("user/cart", {
            cart,
            totalQty,
            removedMessages
        });

    } catch (error) {
        console.error("Load Cart Error:", error);
        res.status(500).send("Error loading cart");
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


        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
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

export {
    loadcart,
    addToCart,
    removeFromCart,
    updateQuantity
}