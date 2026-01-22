import Category from "../../models/categorySchema.js";


const loadCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.render("admin/category", { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};


const addCategory = async (req, res) => {
    try {
        const {
            name,
            description,
            offer,
            offerExpiry
        } = req.body;

// name exist
        const exist = await Category.findOne({ name });
        if (exist) {
            return res.redirect("/admin/categories");
        }

        const category = new Category({
            name,
            description,
            offer: offer || null,
            offerExpiry: offerExpiry ? new Date(offerExpiry) : null
        })

        await category.save();

        res.redirect("/admin/categories")

    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to add category");
    }
}

const editCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const { name, description, offer, offerExpiry } = req.body;

        if (!name || name.trim() == "") {
            return res.redirect("/admin/categories?error=Name required");
        }

        const existing = await Category.findOne({
            name: name.trim(),
            _id: { $ne: id }
        })
        if (existing) {
            return res.redirect("/admin/categories?error=Category already exists")
        }

        await Category.findByIdAndUpdate(id, {
            name: name.trim(),
            description,
            offer: offer ? Number(offer) : 0,
            offerExpiry: offerExpiry ? new Date(offerExpiry) : null
        });

        res.redirect("/admin/categories")
    } catch (error) {
        console.error("Edit category error:", error);
        res.redirect("/admin/categories?error=Something went wrong");
    }
}

const toggleCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);

        if (!category) return res.status(404).send("Category not found")

        category.isListed = !category.isListed;
        await category.save()


        res.status(200).json({ success: true, isListed: category.isListed });
    } catch (error) {
        console.error(err);
        res.status(500).json({ success: false });
    }
}

export {
    loadCategories,
    addCategory,
    editCategory,
    toggleCategory
}
