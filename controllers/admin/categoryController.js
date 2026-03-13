import Category from "../../models/categorySchema.js";


//load category
const loadCategories = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;

        const query = {
            name: { $regex: search, $options: "i" },
            isDeleted: false
        };

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        const error = req.query.error || null;

        res.render("admin/category", {
            categories,
            currentPage: page,
            totalPages,
            search,
            totalCategories,
            error
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};



//add category
const addCategory = async (req, res) => {
    try {
        const {
            name,
            description,
            offer,
            offerExpiry
        } = req.body;


        const exist = await Category.findOne({ name:name.trim()});
        if (exist) {
            return res.status(400).json({ message: "Category already exists" });
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

//edit catrgory
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
            return res.status(400).json({ message: "Category already exists" });
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

//listing ? true :false
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

const softDeleteCategoryc = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).json({ success: false });
        }

        category.isDeleted = true;
        category.isListed = false;

        await category.save();

        res.json({ success: true });

    } catch (error) {
        console.error("Soft delete error:", error);
        res.status(500).json({ success: false });
    }
}


//export
export {
    loadCategories,
    addCategory,
    editCategory,
    toggleCategory,
    softDeleteCategoryc
}
