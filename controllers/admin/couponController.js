import Coupon from "../../models/couponSchema.js";
import Card from "../../models/cartSchema.js";


const loadCoupon = async (req, res) => {
    try {
        const search = req.query.search ? req.query.search.trim() : "";
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;

        let query = {};

        if (search.length > 0) {
            query = {
                $or: [
                    { name: { $regex: new RegExp(search, "i") } },
                    { code: { $regex: new RegExp(search, "i") } }
                ]
            };
        }

        const coupon = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCoupons = await Coupon.countDocuments(query);
        const totalPages = Math.ceil(totalCoupons / limit);

        res.render("admin/coupons", {
            coupon,
            totalPages,
            currentPage: page,
            search
        });

    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");
    }
};

const addCoupon = async (req, res) => {
    try {
        const data = req.body

        const newCoupon = new Coupon({
            name: data.name,
            code: data.code,
            discountType: data.discountType,
            discountValue: data.discountValue,
            minPrice: data.minPrice,
            maxDiscAmount: data.maxDiscAmount,
            expiryDate: data.expiryDate,
            maxUsageCount: data.maxUsageCount,
        });

        await newCoupon.save();

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.log(error);
    }
}


const editcoupon = async (req, res) => {
    try {
        const data = req.body;
        const id = data.couponId;

        await Coupon.findByIdAndUpdate(id, {
            name: data.name,
            code: data.code,
            discountType: data.discountType,
            discountValue: data.discountValue,
            minPrice: data.minPrice,
            maxDiscAmount: data.maxDiscAmount,
            expiryDate: data.expiryDate,
            maxUsageCount: data.maxUsageCount
        });

        return res.redirect("/admin/coupons");
    } catch (error) {
        console.log(error);
        res.redirect("/admin/coupon");
    }
}

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;

        if (!couponId) {
            return res.status(400).json({
                success: false,
                message: "Coupon ID is required"
            });
        }

        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

        if (!deletedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Coupon deleted successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}


const toggleCouponStatus = async (req, res) => {
    try {
        const { couponId, status } = req.body;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }


        if (status === true) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expDate = new Date(coupon.expiryDate);

            if (expDate < today) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot activate an expired coupon. Please update the expiry date first."
                });
            }
        }


        coupon.isActive = status;
        await coupon.save();

        const msg = status ? "Coupon activated successfully" : "Coupon deactivated successfully";

        return res.status(200).json({
            success: true,
            message: msg
        });

    } catch (error) {
        console.error("Toggle Coupon Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred"
        });
    }
};


export {
    loadCoupon,
    addCoupon,
    editcoupon,
    deleteCoupon,
    toggleCouponStatus,
}




