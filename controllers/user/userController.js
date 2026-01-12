import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// --------------------- BASIC PAGE LOADERS ---------------------
const loadHomepage = (req, res) => res.render("user/home");
const loadSignup = (req, res) => res.render("user/signUp");
const loadLoginpage = (req, res) => res.render("user/login");
const loadProfile = (req, res) => res.render("user/profile");
const loadForgotPassword = (req, res) => res.render("user/forgotPass");

const loadVerifyOtp = (req, res) => {
  if (!req.session.otpType || !req.session.otpExpiresAt) {
    return res.redirect("/login");
  }
  res.render("user/verify-otp");
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

// --------------------- HELPERS ---------------------
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

const securePassword = async (password) => bcrypt.hash(password, 10);

// --------------------- AUTHENTICATION LOGIC ---------------------
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

    if (req.session.otpType === "signup" && req.session.userOtp) {
      return res.render("user/verify-otp");
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

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("user/login", { error: "Incorrect password" });

    req.session.user = { _id: user._id, fullname: user.fullname, email: user.email };
    res.redirect("/");
  } catch (error) {
    res.render("user/login", { error: "Login failed" });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};

// --------------------- OTP & PASSWORD RESET ---------------------
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

    res.redirect("/verify-otp");
  } catch (error) {
    console.log(error);
    res.redirect("/forgot-password");
  }
};

const resendotp = async (req, res) => {
  try {
    const { otpType, userData, forgotEmail, lastOtpSent } = req.session;
    if (!otpType) return res.json({ success: false, message: "Session expired" });

    if (Date.now() - (lastOtpSent || 0) < 30000) {
      return res.json({ success: false, message: "Wait 30 seconds" });
    }

    const otp = generateOtp();
    const emailToSend = otpType === "signup" ? userData.email : forgotEmail;
    const emailSent = await sendVerificationEmail(emailToSend, otp);
    if (!emailSent) return res.json({ success: false, message: "OTP sending failed" });

    if (otpType === "signup") req.session.userOtp = otp;
    else req.session.forgotOtp = otp;

    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.lastOtpSent = Date.now();
    res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const { otpType, otpExpiresAt, userOtp, forgotOtp, userData } = req.session;

    if (!otpType) return res.json({ success: false, message: "Session expired" });
    if (Date.now() > otpExpiresAt) return res.json({ success: false, message: "OTP expired" });

    const correctOtp = otpType === "signup" ? userOtp : forgotOtp;
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
    } else if (otpType === "forgot") {
      req.session.allowPasswordReset = true;
      delete req.session.forgotOtp;
      delete req.session.otpExpiresAt;
      return res.json({ success: true, redirectUrl: "/newpass" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Server error" });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const email = req.session.forgotEmail;

    if (!req.session.allowPasswordReset || !email) {
      return res.redirect("/forgot-password");
    }
    if (password !== confirmPassword) {
      return res.render("user/newPass", {
        message: "Passwords do not match",
      });
    }
    const hashedPassword = await securePassword(password);
    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    req.session.destroy();

    res.redirect("/login");
  } catch (error) {
    console.log("Error updating password:", error);
    res.render("user/newPass", { message: "Failed to update password. Try again." });
  }
};

// --------------------- EXPORTS ---------------------
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
};