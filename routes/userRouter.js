import express from "express";
import * as userController from "../controllers/user/userController.js";
import * as cartController from "../controllers/user/cartController.js";
import * as checkoutController from "../controllers/user/checkoutController.js";
import * as PlaceOrderController from "../controllers/user/PlaceOrderController.js";
import * as orderController from "../controllers/user/OrderController.js";
import { requireLogin, guestOnly } from "../middlewares/auth.js";
import passport from "passport";
import { checkUserBlocked } from "../middlewares/adminBLOCK.js";
import noCache from "../middlewares/no-cache.js"
import upload from "../middlewares/multer.js";


const router = express.Router();

router.use(checkUserBlocked)

// home
router.get("/", noCache, userController.loadHomepage);


//load page
router.get("/login", guestOnly, userController.loadLoginpage);
router.get("/signUp", guestOnly, userController.loadSignup);
router.get("/profile", requireLogin, userController.loadProfile);



router.get("/shop", userController.loadshopepage)
router.get("/product/:id", userController.loadProductDetails)
router.get("/newpass", userController.loadnewPassword);

// sign
router.post("/signUp", userController.signUp);

//OTP
router.get("/verify-otp", userController.loadVerifyOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendotp);

// Login
router.post("/login", userController.login);

// forgott
router.get("/forgot-password", guestOnly, userController.loadForgotPassword);
router.post("/forgot-password", userController.sendForgotOtp);

// change pass
router.get("/change-password", requireLogin, userController.loadChangePassword);
router.post("/change-password", requireLogin, userController.updatePasswordProfile);

// change email
router.get("/change-email", requireLogin, userController.loadChangeEmail);
router.post("/change-email", requireLogin, userController.sendChangeEmailOtp);

// New email
router.get("/change-new-email", requireLogin, userController.loadChangenewEmail);
router.post("/change-new-email", requireLogin, userController.sendChangenewEmailOtp);

//edit profile
router.get("/edit-profile", requireLogin, userController.loadEditProfile);
router.post(
  "/edit-profile",
  requireLogin,
  upload.single("avatar"),
  userController.
    updateProfile
);

// address manag
router.get("/address", requireLogin, userController.loadAddress);
router.post("/address/add", requireLogin, userController.addAddress);
router.post("/address/edit", requireLogin, userController.updateAddress);
router.post("/address/delete/:id", requireLogin, userController.deleteAddress);

router.post("/newpass", userController.updatePassword);


// logout
router.post("/logout", requireLogin, userController.logout);


//cart

router.get("/cart", requireLogin, cartController.loadcart)
router.post("/add-to-cart/:productId", requireLogin, cartController.addToCart);
router.post("/cart/remove/:productId", requireLogin, cartController.removeFromCart)
router.post("/cart/update/:productId", requireLogin, cartController.updateQuantity)


router.get("/checkout", noCache, requireLogin, checkoutController.loadcheckout)
router.post("/add-checkout-address", requireLogin, checkoutController.addAddress)
router.post("/edit-checkout-address", requireLogin, checkoutController.editAddress)

router.post("/place-order", noCache, requireLogin, PlaceOrderController.placeOrder);
router.get("/order-success/:orderId", noCache, requireLogin, PlaceOrderController.loadSuccess);


router.get("/orders", requireLogin, orderController.loadOrders)
router.get("/orders/:id", requireLogin, orderController.loadTrackOrders)
router.post("/orders/return-item", requireLogin, orderController.requestReturn);
router.post("/orders/return-all",requireLogin,orderController.requestReturnAll)

// google auth
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false,
  })
);



// google
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false
  }),
  (req, res) => {

    if (req.user.isBlocked) {
      return res.redirect("/login?error=blocked");
    }

    req.session.user = {
      _id: req.user._id,
      email: req.user.email,
      fullname: req.user.fullname,
    };

    return res.redirect("/");
  }
);


export default router;