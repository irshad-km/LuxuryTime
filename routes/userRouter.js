

import express from "express";
import * as userController from "../controllers/user/userController.js";
import { requireLogin, guestOnly } from "../middlewares/auth.js";
import passport from "passport";

const router = express.Router();

//  HOME 
router.get("/", userController.loadHomepage);

// AUTH PAGES 
router.get("/login", guestOnly, userController.loadLoginpage);
router.get("/signUp", guestOnly, userController.loadSignup);
router.get("/profile", requireLogin, userController.loadProfile);
router.get("/newpass", userController.loadnewPassword)

// SIGNUP FLOW 
router.post("/signUp", userController.signUp);

//  OTP FLOW (Signup & Forgot) 
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendotp);

//  LOGIN 
router.post("/login", userController.login);

// FORGOT PASSWORD 
router.get("/forgot-password", guestOnly, userController.loadForgotPassword);
router.post("/forgot-password", userController.sendForgotOtp);

//CHANGE PASSWORD
router.get("/change-password", requireLogin, userController.loadChangePassword)
router.post("/change-password", requireLogin, userController.updatePasswordProfile)

//CHANGE EMAIL
router.get("/change-email", requireLogin, userController.loadChangeEmail)
router.post("/change-email", requireLogin, userController.sendChangeEmailOtp);

//SET NEW EMAIL
router.get("/change-new-email", requireLogin, userController.loadChangenewEmail)
router.post("/change-new-email", requireLogin, userController.sendChangenewEmailOtp);

// EDIT PROFILE
router.get("/edit-profile", requireLogin, userController.loadEditProfile),
  router.post("/edit-profile", requireLogin, userController.updateProfile);

//ADDRESS
router.get("/address", requireLogin, userController.loadAddress);
router.post("/address/add", requireLogin, userController.addAddress)
router.post("/address/edit", requireLogin, userController.updateAddress);
router.post("/address/delete/:id",requireLogin,userController.deleteAddress)



router.post("/newpass", userController.updatePassword)

// LOGOUT 
router.post("/logout", requireLogin, userController.logout);

// GOOGLE AUTH 
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" })
);

//GOOGLE AUTH CALL
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signUp" }),
  (req, res) => res.redirect("/")
);

export default router;



