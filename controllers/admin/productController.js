import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js"


const addProduct = async (req, res) => {
    try {
        const { name, description, category } = req.body;
        const variants = [];

        if (req.body.variants) {
            const variantArray = Array.isArray(req.body.variants)
                ? req.body.variants
                : Object.values(req.body.variants);

            variantArray.forEach((v, index) => {
                let images = [];

                if (req.files && req.files.length > 0) {
                    images = req.files
                        .filter(file => file.fieldname === `variants[${index}][images]`)
                        .map(file => "/uploads/" + file.filename);
                }

                variants.push({
                    color: v.color,
                    regularPrice: Number(v.regularPrice),
                    salePrice: v.salePrice ? Number(v.salePrice) : null,
                    quantity: Number(v.quantity),
                    images: images
                });
            });
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
        res.status(500).send("Something went wrong");
    }
};

const loadEditproduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        const categories = await Category.find({ isListed: true });

        if (!product) {
            return res.redirect("/admin/products");
        }

        res.render("admin/editproduct", {
            product,
            categories
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};


const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, description, category } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.render("admin/editproduct");
        }

        const updatedVariants = [];

        const variantArray = Array.isArray(req.body.variants)
            ? req.body.variants
            : Object.values(req.body.variants);

        variantArray.forEach((variant, index) => {
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

            updatedVariants.push({
                color: variant.color,
                regularPrice: Number(variant.regularPrice),
                salePrice: variant.salePrice ? Number(variant.salePrice) : null,
                quantity: Number(variant.quantity),
                images: [...existingImages, ...newImages]
            });
        });

        product.name = name;
        product.description = description;
        product.category = category;
        product.variants = updatedVariants;

        await product.save();

        res.redirect("/admin/products");

    } catch (error) {
        console.error("Update product error:", error);
        res.status(500).send("Something went wrong");
    }
}

export {
    addProduct,
    loadEditproduct,
    updateProduct
}