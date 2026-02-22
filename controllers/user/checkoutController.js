import Cart from "../../models/cartSchema.js";
import Address from "../../models/userAddress.js";


const loadcheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect("/login");
        }

        let cart = await Cart.findOne({ user: userId })
            .populate("items.product");

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?error=Your cart is empty.");
        }

        let subtotal = 0;

        for (let item of cart.items) {

            if (!item.product || item.product.isDeleted || !item.product.isListed) {
                return res.redirect("/cart?error=Some products are unavailable.");
            }

            const variant = item.product.variants?.[item.variantIndex];

            if (!variant) {
                return res.redirect("/cart?error=Variant unavailable.");
            }

            if (variant.quantity < item.quantity) {
                return res.redirect(
                    `/cart?error=Stock changed for ${item.product.productName}.`
                );
            }

            const latestPrice = variant.salePrice || variant.regularPrice;

            if (item.price !== latestPrice) {
                return res.redirect(
                    `/cart?error=Price updated for ${item.product.productName}.`
                );
            }

            subtotal += item.quantity * latestPrice;
        }

        cart.subtotal = subtotal;
        cart.grandTotal = subtotal;
        await cart.save();

        const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);

        const userAddresses = await Address.find({ userId: userId })


        // const selectedAddress = userAddresses.find(a => a.isDefault) || userAddresses[0] || null;

        res.render("user/checkout", {
            cart,
            totalQty,
            address: userAddresses
        });

    } catch (error) {
        console.error("Checkout Load Error:", error);
        res.status(500).send("Error loading checkout");
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.redirect('/login');
        }

        const { fullname, phone, address, city, state, pincode } = req.body;

        if (!fullname || !phone || !address || !city || !state || !pincode) {
            return res.redirect("/checkout?error=Please fill all fields.");
        }

        const newAddress = new Address({
            userId: userId,
            fullname: fullname,
            phone: phone,
            street: address,
            city: city,
            state: state,
            pincode: pincode,
            country: "India",
        })

        await Address.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } })

        await newAddress.save()

        res.redirect("/checkout");

    } catch (error) {
        console.error("Add Checkout Address Error:", error);
        res.status(500).send("Error adding address");
    }
}

const editAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const addressId = req.body.addressId;

        if (!userId) return res.redirect("/login");

        const { fullname, phone, address, city, state, pincode } = req.body;

        if (!fullname || !phone || !address || !city || !state || !pincode) {
            return res.redirect("/checkout?error=Please fill all fields.");
        }

        await Address.findOneAndUpdate(
            { _id: addressId, userId: userId },
            {
                fullname,
                phone,
                street: address,
                city,
                state,
                pincode
            }
        );

        res.redirect("/checkout");

    } catch (error) {
        console.error("Edit Address Error:", error);
        res.redirect("/checkout?error=Failed to edit address");
    }
};



export {
    loadcheckout,
    addAddress,
    editAddress
}

