import Product from "../../models/productSchema.js";


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

                if (req.files) {
                    images = req.files
                        .filter(file => file.fieldname === `variants[${index}][images]`)
                        .map(file => "/uploads/" + file.filename);
                }

                variants.push({
                    color: v.color,
                    regularPrice: Number(v.regularPrice),
                    salePrice: v.salePrice ? Number(v.salePrice) : null,
                    quantity: Number(v.quantity),
                    images
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


export {
    addProduct,
}