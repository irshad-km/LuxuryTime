import express from "express";
import * as adminController from "../controllers/admin/adminController.js";
import { requireAdminLogin } from "../middlewares/adminauth.js";
import adminSession from "../middlewares/adminsession.js";

const router = express.Router();


router.use(adminSession);


router.get("/", adminController.loadLoginPage); 
router.post("/", adminController.login);         

router.get("/dashboard", requireAdminLogin, adminController.loadDashboard);

router.get("/users", requireAdminLogin, adminController.loadUsers);


router.patch(
    "/users/:id/status",
    requireAdminLogin,
    adminController.toggleUserStatus
);


router.get("/logout", requireAdminLogin, adminController.logout);

export default router;