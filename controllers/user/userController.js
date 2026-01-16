import User from "../../models/userSchema.js";
import Address from "../../models/userAddress.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { error } from "console";

dotenv.config();

/**
 * --- PAGE LOADERS ---
 */
const loadHomepage = async (req, res) => {
  if (req.session.user) {
    const user = await User.findById(req.session.user._id);
    if (!user || user.isBlocked) {
      req.session.destroy(() => { });
      return res.redirect("/login");
    }
  }
  res.render("user/home");
};

const loadSignup = (req, res) => res.render("user/signUp");

const loadLoginpage = (req, res) => {
  let message = null;
  if (req.query.error === "blocked") {
    message = "Your account has been blocked by the admin.";
  }
  res.render("user/login", { message });
};

const loadProfile = (req, res) => res.render("user/profile");
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
    res.render("user/newPass");
  } catch (error) {
    console.log("Error loading new password page:", error);
    res.redirect("/forgot-password");
  }
};

/**
 * --- HELPERS ---
 */
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

// Hashes passwords for secure database storage
const securePassword = async (password) => bcrypt.hash(password, 10);


const signUp = async (req, res) => {
  try {
    const { fullname, email, phone, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.render("user/signUp", { message: "Passwords do not match" });
    }

    const userExist = await User.findOne({ email });
    if (userExist) {
      return res.render("user/signUp", { message: "Email already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/signUp", { message: "OTP sending failed" });
    }

    req.session.userOtp = otp;
    req.session.userData = { fullname, email, phone, password };
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.otpType = "signup";
    req.session.lastOtpSent = Date.now();

    res.render("user/verify-otp");
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

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

const logout = (req, res) => {
  delete req.session.user;
  res.clearCookie("LuxuryTime.user.sid");
  res.redirect("/login");
};

/**
 * --- FORGOT PASSWORD FLOW ---
 */
const sendForgotOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.render("user/forgotPass", { error: "Email not registered" });

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) return res.render("user/forgotPass", { error: "OTP sending failed" });

    req.session.forgotOtp = otp;
    req.session.forgotEmail = email;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.otpType = "forgot";

    res.redirect("/verify-otp")
  } catch (error) {
    console.log(error);
    res.redirect("/forgot-password");
  }
};

/**
 * --- OTP LOGIC (VERIFY & RESEND) ---
 */
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

    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.lastOtpSent = Date.now();

    return res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.log("Resend OTP error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const { otpType, otpExpiresAt, userOtp, forgotOtp, userData, changeNewEmail } = req.session;

    if (!otpType || !otpExpiresAt) return res.json({ success: false, message: "Session expired" });
    if (Date.now() > otpExpiresAt) return res.json({ success: false, message: "OTP expired" });

    const correctOtp = (otpType === "forgot") ? forgotOtp : userOtp;
    if (otp !== correctOtp) return res.json({ success: false, message: "Invalid OTP" });

    if (otpType === "signup") {
      const hashedPassword = await securePassword(userData.password);
      await User.create({
        fullname: userData.fullname,
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        isVerified: true,
      });
      req.session.destroy();
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

/**
 * --- PASSWORD UPDATES ---
 */
const updatePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.forgotEmail;

    if (!req.session.allowPasswordReset || !email) return res.redirect("/forgot-password");
    if (password !== confirmPassword) return res.render("user/newPass", { message: "Passwords do not match" });

    const hashedPassword = await securePassword(password);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });
    req.session.destroy();
    res.redirect("/login");
  } catch (error) {
    res.render("user/newPass", { message: "Failed to update password. Try again." });
  }
};

const updatePasswordProfile = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) return res.render("user/resetPass", { error: "New passwords do not match" });

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.render("user/resetPass", { error: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.redirect("/profile");
  } catch (error) {
    res.redirect("/profile");
  }
}

/**
 * --- EMAIL CHANGE FLOW ---
 */
const loadChangeEmail = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render("user/emailVerify", { user, userEmail: user.email });
  } catch (error) {
    res.redirect("/profile");
  }
};

// Stage 2: Send OTP to current email
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

// Stage 3: Load form for new email
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

/**
 * --- PROFILE MANAGEMENT ---
 */
const loadEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)
    res.render("user/editProfile", { user })
  } catch (error) {
    res.redirect("/profile");
  }
}

const updateProfile = async (req, res) => {
  try {
    const { fullname, phone, gender, dob } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      { fullname, phone, gender, dob },
      { new: true }
    );
    req.session.user = updatedUser;
    return res.redirect("/profile");
  } catch (error) {
    res.redirect("/edit-profile");
  }
};

  // --- ADDRESS MANAGEMENT (CRUD) ---
 
const loadAddress = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.session.user._id });
    res.render("user/address", { user: req.session.user, addresses });
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
  deleteAddress
};