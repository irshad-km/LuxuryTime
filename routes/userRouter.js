

import express from "express";
import * as userController from "../controllers/user/userController.js";
import { requireLogin, guestOnly } from "../middlewares/auth.js";
import passport from "passport";

const router = express.Router();

// --------------------- HOME ---------------------
router.get("/", userController.loadHomepage);

// --------------------- AUTH PAGES ---------------------
router.get("/login", guestOnly, userController.loadLoginpage);
router.get("/signUp", guestOnly, userController.loadSignup);
router.get("/profile", requireLogin, userController.loadProfile);
router.get("/newpass",userController.loadnewPassword)

// --------------------- SIGNUP FLOW ---------------------
router.post("/signUp", userController.signUp);

// --------------------- OTP FLOW (Signup & Forgot) ---------------------
// Use same route for both flows
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendotp);

// --------------------- LOGIN ---------------------
router.post("/login", userController.login);

// --------------------- FORGOT PASSWORD ---------------------
router.get("/forgot-password", guestOnly, userController.loadForgotPassword);
router.post("/forgot-password", userController.sendForgotOtp);

router.post("/newpass",userController.updatePassword)

// --------------------- LOGOUT ---------------------
router.post("/logout", requireLogin, userController.logout);

// --------------------- GOOGLE AUTH ---------------------
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signUp" }),
  (req, res) => res.redirect("/")
);

export default router;



