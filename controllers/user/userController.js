import User from "../../models/userSchema.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// ---------------- Home Page ----------------
const loadHomepage = async (req, res) => {
  try {
    return res.render("user/home"); // always open
  } catch (error) {
    res.status(500).send("Server error");
  }
};

// ---------------- Signup ----------------
const loadSignup = async (req, res) => {
  try {
    res.render("user/signUp");
  } catch (error) {
    res.status(500).send("Server error");
  }
};

// ---------------- Login ----------------
const loadLoginpage = async (req, res) => {
  try {
    return res.render("user/login");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

// ---------------- OTP Generator ----------------
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
};

// ---------------- Signup POST ----------------
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
      return res.render("user/signUp", { message: "Failed to send OTP" });
    }

    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.userData = { fullname, email, phone, password };

    res.render("user/verify-otp");
  } catch (error) {
    res.status(500).send("Server error");
  }
};

// ---------------- OTP Verification ----------------
const securePassword = async (password) => bcrypt.hash(password, 10);

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.userOtp || !req.session.userData) {
      return res.json({ success: false, message: "OTP expired. Signup again" });
    }

    if (Date.now() > req.session.otpExpiresAt) {
      delete req.session.userOtp;
      delete req.session.userData;
      delete req.session.otpExpiresAt;
      return res.json({ success: false, message: "OTP expired. Signup again" });
    }

    if (otp !== req.session.userOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const hashedPassword = await securePassword(req.session.userData.password);
    const newUser = new User({
      fullname: req.session.userData.fullname,
      email: req.session.userData.email,
      phone: req.session.userData.phone,
      password: hashedPassword,
      isVerified: true,
    });

    await newUser.save();

    delete req.session.userOtp;
    delete req.session.userData;
    delete req.session.otpExpiresAt;

    return res.json({ success: true, redirectUrl: "/login" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------- Resend OTP ----------------
const resendotp = async (req, res) => {
  try {
    if (!req.session.userData?.email) {
      return res.json({ success: false, message: "Session expired. Signup again" });
    }

    if (req.session.lastotpsent && Date.now() - req.session.lastotpsent < 30000) {
      return res.json({ success: false, message: "Wait before resending OTP" });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.lastotpsent = Date.now();

    const emailSent = await sendVerificationEmail(req.session.userData.email, otp);
    if (!emailSent) return res.json({ success: false, message: "Failed to send OTP" });

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
};

// ---------------- Login ----------------
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isAdmin: false });

    if (!user) return res.render("user/login", { error: "User not found" });
    if (!user.isVerified) return res.render("user/login", { error: "Verify email first" });
    if (user.isBlocked) return res.render("user/login", { error: "Blocked by admin" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.render("user/login", { error: "Incorrect password" });

    req.session.user = { _id: user._id, fullname: user.fullname, email: user.email };
    return res.redirect("/");
  } catch (error) {
    console.error(error);
    return res.render("user/login", { error: "Login failed" });
  }
};

// ---------------- Logout ----------------
const logout = (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  });
};

export {
  loadHomepage,
  loadSignup,
  loadLoginpage,
  signUp,
  verifyOtp,
  resendotp,
  login,
  logout,
};
