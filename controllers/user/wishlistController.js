import Wishlist from "../../models/wishlistSchema.js";


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect("/login");
        }

        const wishlistData = await Wishlist.findOne({ userId })
            .populate({
                path: "products.productId",
                match: { isListed: true, isDeleted: false }, 
                populate: { 
                    path: "category",
                    match: { isListed: true, isDeleted: false } 
                } 
            })
            .lean();

        if (!wishlistData) {
            return res.render("user/wishlist", { wishlist: [], wishlistCount: 0, user: req.session.user });
        }

        const wishlist = wishlistData.products.map(item => {
            const product = item.productId;
            
            
            if (!product || !product.category) return null;

            const variant = product.variants.find(v => v._id.toString() === item.variantId.toString()) || product.variants[0];

            const categoryOffer = product.category?.offer || 0;
            const variantOffer = variant?.offer || 0;
            const bestOffer = Math.max(categoryOffer, variantOffer);
            
            const regPrice = variant?.salePrice || 0;
            const finalPrice = Math.floor(regPrice - (regPrice * (bestOffer / 100)));

            return {
                ...item,
                productName: product.name,
                image: variant?.images?.[0] || product.images?.[0] || "/images/products/default.png",
                price: finalPrice,
                regularPrice: regPrice,
                bestOffer: bestOffer,
                hasStock: variant?.quantity > 0
            };
        }).filter(item => item !== null);

        res.render("user/wishlist", {
            wishlist,
            wishlistCount: wishlist.length,
            user: req.session.user,
        });

    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).redirect("/home");
    }
};

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login first" });
        }

        const { productId, variantId, name, image, price, material, size, dotColor } = req.body;

    

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: []
            });
        }

        const isExisting = wishlist.products.find(
            (item) => item.productId.toString() === productId
        );

        if (isExisting) {
            return res.status(400).json({
                success: false,
                message: "Product already in wishlist"
            });
        }

        const newProduct = {
            productId,
            name,
            image,
            price,
            material,
            size,
            dotColor,
            variantId: (variantId && variantId !== "") ? variantId : productId 
        };

        if (variantId && variantId !== "null" && variantId.trim() !== "") {
            newProduct.variantId = variantId;
        }

        wishlist.products.push(newProduct);
        await wishlist.save();
        console.log(wishlist)

       
        const updatedCount = wishlist.products.length;

        return res.status(200).json({
            success: true,
            message: "Product added to wishlist",
            wishlistCount: updatedCount 
        });

    } catch (error) {
        console.error("Wishlist Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


const removeItem = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user_id;
        
        const { productId, variantId } = req.params;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const result = await Wishlist.updateOne(
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

        if (result.modifiedCount > 0) {
            res.status(200).json({
                success: true,
                message: "Product removed from wishlist"
            });
        } else {
            res.status(404).json({
                success: false,
                message: "Item not found in wishlist"
            });
        }

    } catch (error) {
        console.error("Wishlist Remove Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export {
    loadWishlist,
    addToWishlist,
    removeItem
}




