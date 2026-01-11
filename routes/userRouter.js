import express from "express";
import * as userController from "../controllers/user/userController.js";
import { requireLogin, guestOnly } from "../middlewares/auth.js";
import passport from "passport";

const router = express.Router();



// Home 
router.get("/", userController.loadHomepage);

//  Auth
router.get("/login", guestOnly, userController.loadLoginpage);
router.get("/signUp", guestOnly, userController.loadSignup);

router.post("/login", userController.login);
router.post("/signUp", userController.signUp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendotp);

//  Logout 
router.post("/logout", userController.logout);

// Google Auth 
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
);
router.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signUp" }),
    (req, res) => res.redirect("/")
);

export default router;
