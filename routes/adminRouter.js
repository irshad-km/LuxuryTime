import express from "express";
import * as adminController from "../controllers/admin/adminController.js";
import { requireAdminLogin } from "../middlewares/adminBLOCK.js";
// import adminSession from "../middlewares/adminsession.js";
import * as categoryController from "../controllers/admin/categoryController.js";
import * as productController from "../controllers/admin/productController.js";
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

router.get("/logout", requireAdminLogin, adminController.logout);

export default router;