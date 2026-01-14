import express from "express";
import * as adminController from "../controllers/admin/adminController.js"
import passport from "passport";
import { guestOnly, requireAdminLogin } from "../middlewares/adminauth.js";

const router = express.Router();

router.get("/", adminController.loadLoginPage);
router.post("/", adminController.login);
router.get("/dashboard",requireAdminLogin,adminController.loadDashboard)
router.get("/users", requireAdminLogin, adminController.loadUsers);
router.patch("/users/:id/status",requireAdminLogin,adminController.toggleUserStatus)


export default router;

