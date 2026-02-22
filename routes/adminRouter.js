import express from "express";
import * as adminController from "../controllers/admin/adminController.js";
import { requireAdminLogin } from "../middlewares/adminBLOCK.js";
// import adminSession from "../middlewares/adminsession.js";
import * as categoryController from "../controllers/admin/categoryController.js";
import * as productController from "../controllers/admin/productController.js";
import * as orderController from "../controllers/admin/orderController.js";
import upload from "../middlewares/multer.js";

const router = express.Router();


router.get("/", adminController.loadLoginPage);
router.post("/", adminController.login);

router.get("/dashboard", requireAdminLogin, adminController.loadDashboard);

router.get("/users", requireAdminLogin, adminController.loadUsers);
router.patch(
    "/users/:id/status",
    requireAdminLogin,
    adminController.toggleUserStatus
);

router.get("/products", requireAdminLogin, adminController.loadproduct)
router.get("/addproduct", requireAdminLogin, adminController.loadaddproduct)
router.get("/products/edit/:id", requireAdminLogin, productController.loadEditproduct)
router.patch("/toggleProduct/:id", requireAdminLogin, productController.toggleProduct);
router.patch("/softDeleteProduct/:id", requireAdminLogin, productController.softDeleteProduct)
router.post(
    "/products/add",
    requireAdminLogin,
    upload.any(),
    productController.
        addProduct
);
router.post(
    "/products/edit/:id",
    requireAdminLogin,
    upload.any(),
    productController.
        updateProduct
)

router.get("/categories", requireAdminLogin, categoryController.loadCategories)
router.post("/addCategory", requireAdminLogin, categoryController.addCategory)
router.post("/editCategory/:id", requireAdminLogin, categoryController.editCategory)
router.patch("/toggleCategory/:id", requireAdminLogin, categoryController.toggleCategory)
router.patch("/softDeleteCategory/:id", requireAdminLogin, categoryController.softDeleteCategoryc)

router.get("/orders", requireAdminLogin, orderController.loadOrders)
router.get("/orders/:id", requireAdminLogin, orderController.loadordersdetails)
router.post("/orders/update-status", requireAdminLogin, orderController.updateOrderStatus)
router.post("/orders/approve-return",requireAdminLogin,orderController.approveReturn);
router.post("/orders/reject-return",requireAdminLogin,orderController.rejectReturn)



router.get("/logout", requireAdminLogin, adminController.logout);

export default router;