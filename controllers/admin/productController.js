import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js"


//add product
const addProduct = async (req, res) => {
    try {
        const { name, description, category } = req.body;
        const categories = await Category.find({ isListed: true });

        const existingProduct = await Product.findOne({
            name: { $regex: `^${name}$`, $options: "i" },
            category: category,
        });


        if (existingProduct) {
            return res.render("admin/addproduct", {
                categories,
                error: "Product name already exists"
            });
        }

        const variants = [];

        if (req.body.variants) {
            const variantArray = Array.isArray(req.body.variants)
                ? req.body.variants
                : Object.values(req.body.variants);

            for (let index = 0; index < variantArray.length; index++) {
                const v = variantArray[index];

                const regularPrice = Number(v.regularPrice);
                const salePrice = v.salePrice ? Number(v.salePrice) : null;
                const quantity = Number(v.quantity);

                if (salePrice !== null && salePrice >= regularPrice) {
                    return res.render("admin/addproduct", {
                        categories,
                        error: "Salse prise is greaterdhan regularPrice"
                    });
                }

                let images = [];

                if (req.files && req.files.length > 0) {
                    images = req.files
                        .filter(file => file.fieldname === `variants[${index}][images]`)
                        .map(file => "/uploads/" + file.filename);
                }



                if (images.length < 3) {
                    return res.render("admin/addproduct", {
                        categories,
                        error: "Maximum 3 images allowed per variant"
                    });
                }


                variants.push({
                    color: v.color,
                    regularPrice,
                    salePrice,
                    quantity,
                    images,
                });
            };
        }

        const newProduct = new Product({
            name,
            description,
            category,
            variants
        });

        await newProduct.save();

        res.redirect("/admin/products");

    } catch (error) {
        console.error("Add product error:", error);
        const categories = await Category.find({ isListed: true });
        res.render("admin/addproduct", {
            categories,
            error: "Something went wrong. Please try again."
        });
    }
};


//load edit page
const loadEditproduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const categories = await Category.find({ isListed: true });

        if (!product) {
            return res.redirect("/admin/products");
        }

        res.render("admin/editproduct", {
            product,
            categories,
            error: null
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};


//update product
const updateProduct = async (req, res) => {
    try {

        const productId = req.params.id;
        const { name, description, category } = req.body;

        const product = await Product.findById(productId);
        const categories = await Category.find({ isListed: true });


        if (!product) {
            return res.render("admin/editproduct");
        }
        const existingProduct = await Product.findOne({
            _id: { $ne: productId },
            category: category,
            name: { $regex: `^${name}$`, $options: "i" }
        });

        if (existingProduct) {
            return res.render("admin/editproduct", {
                product,
                categories,
                error: "Product name already exists"
            });
        }

        const updatedVariants = [];

        const variantArray = Array.isArray(req.body.variants)
            ? req.body.variants
            : Object.values(req.body.variants);

        for (let index = 0; index < variantArray.length; index++) {
            const variant = variantArray[index];

            let existingImages = [];

            if (variant.existingImages) {
                existingImages = Array.isArray(variant.existingImages)
                    ? variant.existingImages
                    : [variant.existingImages];
            }

            let newImages = [];
            if (req.files && req.files.length > 0) {
                newImages = req.files
                    .filter(file => file.fieldname === `variants[${index}][images]`)
                    .map(file => "/uploads/" + file.filename);
            }

            const totalImages = [...existingImages, ...newImages];

            if (totalImages.length < 3) {
                return res.render("admin/editproduct", {
                    product,
                    categories,
                    error: "Each variant must have at least 3 images"
                });
            }

            const regularPrice = Number(variant.regularPrice);
            const salePrice = variant.salePrice ? Number(variant.salePrice) : null;

            if (salePrice !== null && salePrice >= regularPrice) {
                return res.render("admin/editproduct", {
                    product,
                    categories,
                    error: "Salse prise is greaterdhan regularPrice",
                })
            }

            updatedVariants.push({
                color: variant.color,
                regularPrice,
                salePrice,
                quantity: Number(variant.quantity),
                images: totalImages
            });
        };

        product.name = name;
        product.description = description;
        product.category = category;
        product.variants = updatedVariants;

        await product.save();

        res.redirect("/admin/products");

    } catch (error) {
        console.error("Update product error:", error);
        const categories = await Category.find({ isListed: true });
        const product = await Product.findById(req.params.id);

        res.render("admin/editproduct", {
            product,
            categories,
            error: "Something went wrong. Please try again."
        });
    }
}



//listed & unlist
const toggleProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        product.isListed = !product.isListed;
        await product.save();

        res.status(200).json({
            success: true,
            isListed: product.isListed
        });

    } catch (error) {
        console.error("Toggle product error:", error);
        res.status(500).json({ success: false });
    }
};


//soft delete
const softDeleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ success: false });
        }

        product.isDeleted = true;
        product.isListed = false;

        await product.save();

        res.json({ success: true });

    } catch (error) {
        console.error("Soft delete error:", error);
        res.status(500).json({ success: false });
    }
}


//export
export {
    addProduct,
    loadEditproduct,
    updateProduct,
    toggleProduct,
    softDeleteProduct
}