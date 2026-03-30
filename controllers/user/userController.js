import User from "../../models/userSchema.js";
import Product from "../../models/productSchema.js";
import Category from "../../models/categorySchema.js";
import Address from "../../models/userAddress.js";
import Wallet from "../../models/walletSchema.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();


// home page
const loadHomepage = async (req, res) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user._id);

      if (!user || user.isBlocked) {
        delete req.session.user;
        res.clearCookie("LuxuryTime.user.sid");
        return res.redirect("/login");
      }
    }

    const products = await Product.find({
      isListed: true
    })
      .populate({
        path: "category",
        match: { isListed: true }
      })
      .sort({ createdAt: -1 })
      .limit(8);

    const filteredProducts = products.filter(
      p => p.category !== null
    );

    const latestProducts = filteredProducts.map(p => {
      const mainVariant = p.variants[0] || {};

      return {
        _id: p._id,
        name: p.name,
        price: mainVariant.salePrice || 0,
        image: mainVariant.images?.[0] || "/images/products/default.png"
      };
    });



    res.render("user/home", {
      latestProducts
    });

  } catch (error) {
    console.error("Load home page error:", error);
    res.status(500).send("Server error");
  }
};



const loadSignup = (req, res) => res.render("user/signUp");


const loadLoginpage = (req, res) => {
  try {
    let errorMessage = null;
    if (req.query.error === "blocked") {
      errorMessage = "Your account has been blocked by the admin.";
    }
    res.render("user/login", { error: errorMessage });
  } catch (error) {
    console.log(error);
    res.status(500).render("user/login", {
      error: "Something went wrong. Please try again later."
    });
  };
}

const loadProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);

    if (!user) {
      return res.redirect("/login");
    }

    res.render("user/profile", { user });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
};

const loadForgotPassword = (req, res) => res.render("user/forgotPass");
const loadChangePassword = (req, res) => res.render("user/resetPass")


const loadVerifyOtp = (req, res) => {
  if (!req.session.otpType || !req.session.otpExpiresAt) {
    return res.redirect("/login");
  }
  res.render("user/verify-otp", {
    otpType: req.session.otpType
  });
};

const loadnewPassword = async (req, res) => {
  try {
    if (!req.session.allowPasswordReset) {
      return res.redirect("/forgot-password");
    }
    res.render("user/newpass");
  } catch (error) {
    console.log("Error loading new password page:", error);
    res.redirect("/forgot-password");
  }
};

//genarat OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "OTP Verification",
      html: `<h3>Your OTP: ${otp}</h3>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.log("Email error:", error);
    return false;
  }
};


//bcrypt pass
const securePassword = async (password) => bcrypt.hash(password, 10);


//signup
const signUp = async (req, res) => {
  try {
    const { fullname, email, phone, password, confirmPassword, referral } = req.body;

    let message = null
    if (password !== confirmPassword) {
      return res.render("user/signUp", { message: "Passwords do not match" });
    }


    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.render("user/signUp", { message: "Email already exists" });
    }

    let referrer = null;


    if (referral && referral.trim() !== "") {
      referrer = await User.findOne({ referralCode: referral });
      if (!referrer) {
        return res.render("user/signUp", { message: "Invalid referral code" });
      }
    }


    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("user/signUp", { message: "OTP sending failed" });
    }


    req.session.userOtp = otp;
    req.session.userData = { fullname, email, phone, password };
    req.session.referrerId = referrer ? referrer._id : null;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.otpType = "signup";
    req.session.lastOtpSent = Date.now();

    res.render("user/verify-otp",
      message
    );

  } catch (error) {
    console.error("SignUp Error:", error);
    res.status(500).send("Server error");
  }
};


// login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isAdmin: false });

    if (!user) return res.render("user/login", { error: "User not found" });

    if (!user.isVerified) return res.render("user/login", { error: "Verify your email" });

    if (user.isBlocked) {
      return res.render("user/login", { error: "Your account has been blocked by admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.render("user/login", { error: "Incorrect password" });

    //login user session
    req.session.user = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email
    };

    res.redirect("/");
  } catch (error) {
    res.render("user/login", { error: "Login failed" });
  }
};

//logout
const logout = (req, res) => {
  delete req.session.user
  res.clearCookie("LuxuryTime.user.sid");
  res.redirect("/login");
};



// Forgott pass
const sendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgotPass", { error: "Email not registered" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("user/forgotPass", { error: "OTP sending failed" });
    }

    req.session.forgotOtp = otp;
    req.session.forgotEmail = email;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.otpType = "forgot";
    req.session.lastOtpSent = Date.now();

    return res.redirect("/verify-otp");
  } catch (error) {
    console.log("sendForgotOtp error:", error);
    return res.redirect("/forgot-password");
  }
};

//  OTP logic
const resendotp = async (req, res) => {
  try {
    const { otpType, userData, forgotEmail, lastOtpSent, changeNewEmail } = req.session;

    if (!otpType) return res.json({ success: false, message: "Session expired" });

    if (Date.now() - (lastOtpSent || 0) < 30000) {
      return res.json({ success: false, message: "Wait 30 seconds before resending" });
    }

    let emailToSend;
    switch (otpType) {
      case "signup": emailToSend = userData?.email; break;
      case "forgot": emailToSend = forgotEmail; break;
      case "changeEmail": emailToSend = req.session.user.email; break;
      case "changenewEmail": emailToSend = changeNewEmail?.newEmail; break;
      default: return res.json({ success: false, message: "Invalid OTP type" });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(emailToSend, otp);
    if (!emailSent) return res.json({ success: false, message: "OTP sending failed" });

    if (otpType === "forgot") {
      req.session.forgotOtp = otp;
    } else {
      req.session.userOtp = otp;
    } req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.lastOtpSent = Date.now();

    return res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.log("Resend OTP error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};


//verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const { otpType, otpExpiresAt, userOtp, forgotOtp, userData, changeNewEmail, referrerId } = req.session;

    if (!otpType || !otpExpiresAt) return res.json({ success: false, message: "Session expired" });
    if (Date.now() > otpExpiresAt) return res.json({ success: false, message: "OTP expired" });

    const correctOtp = (otpType === "forgot") ? forgotOtp : userOtp;
    if (otp !== correctOtp) return res.json({ success: false, message: "Invalid OTP" });

    if (otpType === "signup") {
      const hashedPassword = await securePassword(userData.password);

      const generateReferralCode = (fullname) => {
        const random = Math.floor(1000 + Math.random() * 9000);
        return fullname.slice(0, 3).toUpperCase() + random;
      };

      const newUser = await User.create({
        fullname: userData.fullname,
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        isVerified: true,
        referralCode: generateReferralCode(userData.fullname),
        referredBy: referrerId || null,
      });


      if (referrerId) {

        await Wallet.findOneAndUpdate(
          { userId: referrerId },
          {
            $inc: { balance: 100 },
            $push: {
              transactions: {
                transactionType: "credit",
                amount: 100,
                source: "referral_bonus",
                status: "success",
                description: "Referral bonus for inviting " + userData.fullname
              }
            }
          },
          { upsert: true, new: true }
        );


        await Wallet.create({
          userId: newUser._id,
          balance: 50,
          transactions: [{
            transactionType: "credit",
            amount: 50,
            source: "referral_bonus",
            status: "success",
            description: "Welcome bonus from referral"
          }]
        });
      } else {

        await Wallet.create({
          userId: newUser._id,
          balance: 0,
          transactions: []
        });
      }


      req.session.userData = null;
      req.session.referrerId = null;

      return res.json({ success: true, redirectUrl: "/login" });
    }
    else if (otpType === "forgot") {
      req.session.allowPasswordReset = true;
      return res.json({ success: true, redirectUrl: "/newpass" });
    }
    else if (otpType === "changeEmail") {
      return res.json({ success: true, redirectUrl: "/change-new-email" });
    }
    else if (otpType === "changenewEmail") {
      const { userId, newEmail } = req.session.changeNewEmail;
      await User.findByIdAndUpdate(userId, { email: newEmail, isVerified: true });
      req.session.user.email = newEmail;
      return res.json({ success: true, redirectUrl: "/profile" });
    }
  } catch (error) {
    console.log("Verify OTP Error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};


//password update in
const updatePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.forgotEmail;

    if (!req.session.allowPasswordReset || !email) return res.redirect("/forgot-password");

    if (password !== confirmPassword) return res.render("user/newpass", { message: "Passwords do not match" });

    const hashedPassword = await securePassword(password);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });
    delete req.session.user
    res.redirect("/login");
  } catch (error) {
    res.render("user/newpass", { message: "Failed to update password. Try again." });
  }
};

//update pass profile
const updatePasswordProfile = async (req, res) => {
  try {

    if (!req.session.user) {
      return res.redirect("/login");
    }

    const userId = req.session.user._id
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.render("user/resetPass", {
        message: "New passwords do not match"
      });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.render("user/resetPass", {
        message: "User not found"
      });
    }

    if (user.googleId && !user.password) {
      return res.render("user/resetPass", {
        message: "Google login users must set a password first"
      });
    }


    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.render("user/resetPass", {
        message: "Current password is incorrect"
      });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    delete req.session.user;
    res.redirect("/login");
  } catch (error) {
    res.redirect("/profile");
  }
}


// Change email
const loadChangeEmail = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("user/emailVerify", { user, userEmail: user.email });
  } catch (error) {
    res.redirect("/profile");
  }
};


const sendChangeEmailOtp = async (req, res) => {
  try {
    const currentEmail = req.session.user.email;
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(currentEmail, otp);
    if (!emailSent) return res.render("user/emailVerify", { error: "Failed to send OTP" });

    req.session.userOtp = otp;
    req.session.otpType = "changeEmail";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    res.redirect("/verify-otp");
  } catch (error) {
    res.redirect("/profile");
  }
};

const loadChangenewEmail = async (req, res) => {
  try {
    const user = req.session.user;
    const email = user.email;
    const maskedEmail = email.slice(0, 2) + "****" + email.slice(email.indexOf("@"));
    res.render("user/changeEmail", { user: { ...user, maskedEmail } });
  } catch (error) {
    res.redirect("/profile");
  }
}

const sendChangenewEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.session.user._id;

    if (newEmail === req.session.user.email) return res.render("user/changeEmail", { error: "Please enter a new email address" });

    const emailExists = await User.findOne({ email: newEmail, _id: { $ne: userId } });
    if (emailExists) return res.render("user/changeEmail", { error: "Email already in use" });

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(newEmail, otp);
    if (!emailSent) return res.render("user/changeEmail", { error: "Failed to send OTP" });

    req.session.userOtp = otp;
    req.session.otpType = "changenewEmail";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.changeNewEmail = { userId, newEmail };
    res.redirect("/verify-otp");
  } catch (error) {
    res.redirect("/profile");
  }
};


//profile
const loadEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)

    res.render("user/editProfile", {
      user,
      error: null
    })
  } catch (error) {
    console.log(error);
    res.redirect("/profile");
  }
}

const updateProfile = async (req, res) => {
  try {
    const { fullname, phone, removeAvatar } = req.body;

    const updateData = {
      fullname,
      phone,
    };

    if (removeAvatar === "true") {
      updateData.avatar = "/default-avatar.png";
    }

    if (req.file) {
      updateData.avatar = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      updateData,
      { new: true }
    );

    req.session.user = updatedUser;

    return res.redirect("/profile");
  } catch (error) {
    console.log(error);
    res.redirect("/edit-profile");
  }
};
// address 

const loadAddress = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.session.user._id });
    const user = await User.findById(req.session.user._id);

    res.render("user/address", { user: req.session.user, addresses, user, error: null });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const addAddress = async (req, res) => {
  try {
    const { fullname, phone, street, city, state, pincode, country, isDefault } = req.body;
    const userId = req.session.user._id;

    if (isDefault) await Address.updateMany({ userId }, { $set: { isDefault: false } });

    await Address.create({
      userId, fullname, phone, street, city, state, pincode, country, isDefault: !!isDefault
    });
    res.redirect("/address");
  } catch (error) {
    res.redirect("/address");
  }
};

const updateAddress = async (req, res) => {
  try {
    const { addressId, fullname, phone, street, city, state, pincode, country, isDefault } = req.body;
    const userId = req.session.user._id;

    if (isDefault) await Address.updateMany({ userId }, { $set: { isDefault: false } });

    await Address.findByIdAndUpdate(addressId, {
      fullname, phone, street, city, state, pincode, country, isDefault: !!isDefault
    });
    res.redirect("/address");
  } catch (error) {
    res.redirect("/address");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user._id;
    await Address.deleteOne({ _id: addressId, userId });
    res.redirect("/address");
  } catch (error) {
    res.redirect("/address");
  }
};


const loadshopepage = async (req, res) => {
  try {
    const { category, price, sort, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    let filter = { isListed: true, isDeleted: false };

    const listedCategories = await Category.find({ isListed: true, isDeleted: false });
    filter.category = { $in: listedCategories.map(cat => cat._id) };

    if (category && category !== "all") {
      const categoryDoc = listedCategories.find(c => c.name === category);
      if (categoryDoc) filter.category = categoryDoc._id;
    }

    if (search && search.trim() !== "") {
      filter.name = { $regex: search, $options: "i" };
    }

    if (price) {
      if (price === "under1000") filter["variants.salePrice"] = { $lt: 1000 };
      else if (price === "1000-5000") filter["variants.salePrice"] = { $gte: 1000, $lte: 5000 };
      else if (price === "above5000") filter["variants.salePrice"] = { $gt: 5000 };
    }

    const allProducts = await Product.find(filter).populate("category");

    let formattedProducts = allProducts.map(p => {
      const mainVariant = p.variants[0] || {};
      const sPrice = mainVariant.salePrice || 0;
      const bestOffer = Math.max(mainVariant.offer || 0, p.category?.offer || 0);
      const finalPrice = Math.floor(sPrice - (sPrice * (bestOffer / 100)));

      return {
        _id: p._id,
        name: p.name,
        description: p.description,
        regularPrice: mainVariant.regularPrice || 0,
        salePrice: finalPrice,
        offerPercentage: bestOffer,
        image: mainVariant.images?.[0] || "/images/products/default.png",
        createdAt: p.createdAt
      };
    });

    if (sort === "priceLow") formattedProducts.sort((a, b) => a.salePrice - b.salePrice);
    else if (sort === "priceHigh") formattedProducts.sort((a, b) => b.salePrice - a.salePrice);
    else if (sort === "new") formattedProducts.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "a-z") formattedProducts.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "z-a") formattedProducts.sort((a, b) => b.name.localeCompare(a.name));

    const totalProducts = formattedProducts.length;
    const paginatedProducts = formattedProducts.slice(skip, skip + limit);

    res.render("user/shop", {
      products: paginatedProducts,
      categories: listedCategories,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      category: category || "all",
      price: price || "",
      sort: sort || "",
      search: search || "",
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};


//load details page
const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isListed: true
    }).populate("category");


    if (!product || !product.category || !product.category.isListed) {
      return res.redirect("/shop");
    }

    const categoryOffer = product.category?.offer || 0;
    const variantsWithOffers = product.variants.map(v => {
      const variantOffer = v.offer || 0;
      const bestOffer = Math.max(variantOffer, categoryOffer);
      const regPrice = v.salePrice || 0;
      const salePrice = Math.floor(regPrice - (regPrice * (bestOffer / 100)));

      return {
        ...v.toObject(),
        calculatedSalePrice: salePrice,
        bestOffer: bestOffer,
        hasStock: Number(v.quantity) > 0
      };
    });

    const mainPricing = variantsWithOffers[0] || {};
    product.calculatedSalePrice = mainPricing.calculatedSalePrice;
    product.bestOffer = mainPricing.bestOffer;
    product.regularPrice = mainPricing.salePrice;

    const relatedProductsRaw = await Product.find({
      _id: { $ne: product._id },
      category: product.category._id,
      isListed: true,
      isDeleted: false
    }).populate("category").limit(4);

    const relatedProducts = relatedProductsRaw.map(p => {
      const v = p.variants[0] || {};
      const vOffer = v.offer || 0;
      const cOffer = p.category?.offer || 0;
      const bOffer = Math.max(vOffer, cOffer);
      const regPrice = v.salePrice || 0;

      return {
        ...p.toObject(),
        salePrice: Math.floor(regPrice - (regPrice * (bOffer / 100))),
        regularPrice: regPrice,
        offerPercentage: bOffer,
        image: v.images?.[0] || "/images/products/default.png"
      };
    });

    res.render("user/productDetails", {
      product,
      relatedProducts,
      variants: variantsWithOffers
    });

  } catch (err) {
    console.log(err);
    res.redirect("/shop");
  }
};


const loadAboutPage = async (req, res) => {
  try {
    const pageData = {
      title: "Our Heritage | Luxury Time",

      history: [
        { year: "1985", milestone: "The Foundation", desc: "Our first workshop opens in Geneva." },
        { year: "2010", milestone: "Modern Innovation", desc: "Launch of our first proprietary automatic movement." },
        { year: "2026", milestone: "Digital Legacy", desc: "Blending traditional horology with modern smart tech." }
      ],

      features: [
        { icon: "⚙️", label: "Precision Engineering", detail: "Internationally recognized movements." },
        { icon: "💎", label: "Premium Materials", detail: "Surgical steel and sapphire crystal." },
        { icon: "🤲", label: "Hand-Finished", detail: "Assembled by master watchmakers." },
        { icon: "🛡️", label: "Quality Checks", detail: "72-hour rigorous performance testing." }
      ]
    };

    res.render('user/about', pageData);

  } catch (error) {
    console.error("Error rendering about page:", error);
    res.status(500).render('error', { message: "Could not load the about page." });
  }
};



// EXPORTS
export {
  loadHomepage,
  loadSignup,
  loadLoginpage,
  loadProfile,
  loadForgotPassword,
  loadVerifyOtp,
  loadnewPassword,
  signUp,
  sendForgotOtp,
  resendotp,
  verifyOtp,
  login,
  logout,
  updatePassword,
  loadChangePassword,
  updatePasswordProfile,
  loadChangeEmail,
  sendChangeEmailOtp,
  loadChangenewEmail,
  sendChangenewEmailOtp,
  loadEditProfile,
  updateProfile,
  loadAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  loadshopepage,
  loadProductDetails,
  loadAboutPage
};