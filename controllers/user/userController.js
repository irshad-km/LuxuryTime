import User from "../../models/userSchema.js";
import Address from "../../models/userAddress.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { error } from "console";

dotenv.config();

//PAGE LOADERS 
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
const loadLoginpage = (req, res) => res.render("user/login");
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

// HELPERS 
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

//PASSWORS BCRYPT
const securePassword = async (password) => bcrypt.hash(password, 10);

//AUTHENTICATION SIGHNP
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

//AUTHENTICATION LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isAdmin: false });

    if (!user) return res.render("user/login", { error: "User not found" });

    if (!user.isVerified) return res.render("user/login", { error: "Verify your email" });

    if (user.isBlocked) {
      return res.render("user/login", {
        error: "Your account has been blocked by admin",
      });
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
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};

//  OTP FORGOTT  
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

const resendotp = async (req, res) => {
  try {
    const {
      otpType,
      userData,
      forgotEmail,
      lastOtpSent,
      user,
      changeNewEmail
    } = req.session;

    if (!otpType) {
      return res.json({ success: false, message: "Session expired" });
    }


    if (Date.now() - (lastOtpSent || 0) < 30000) {
      return res.json({ success: false, message: "Wait 30 seconds before resending" });
    }

    let emailToSend;


    switch (otpType) {
      case "signup":
        emailToSend = userData?.email;
        break;

      case "forgot":
        emailToSend = forgotEmail;
        break;

      case "changeEmail":
        emailToSend = req.session.user.email;
        break;

      case "changenewEmail":
        emailToSend = changeNewEmail?.newEmail;
        break;

      default:
        return res.json({ success: false, message: "Invalid OTP type" });
    }

    if (!emailToSend) {
      return res.json({ success: false, message: "Email not found for OTP" });
    }


    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(emailToSend, otp);

    if (!emailSent) {
      return res.json({ success: false, message: "OTP sending failed" });
    }


    req.session.userOtp = otp;
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.lastOtpSent = Date.now();

    return res.json({ success: true, message: "OTP resent successfully" });

  } catch (error) {
    console.log("Resend OTP error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};


//VERIFY OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    const {
      otpType,
      otpExpiresAt,
      userOtp,
      forgotOtp,
      userData,
      changeEmail,
      changeNewEmail
    } = req.session;


    if (!otpType || !otpExpiresAt) {
      return res.json({ success: false, message: "Session expired" });
    }

    if (Date.now() > otpExpiresAt) {
      return res.json({ success: false, message: "OTP expired" });
    }

    let correctOtp;
    if (
      otpType === "signup" ||
      otpType === "changeEmail" ||
      otpType === "changenewEmail"
    ) {
      correctOtp = userOtp;
    } else if (otpType === "forgot") {
      correctOtp = forgotOtp;
    }


    if (otp !== correctOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    //SIGNUP OTP
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

      return res.json({
        success: true,
        redirectUrl: "/login",
      });
    }

    //FORGOT PASSWORD OTP 
    else if (otpType === "forgot") {
      req.session.allowPasswordReset = true;

      delete req.session.forgotOtp;
      delete req.session.otpExpiresAt;
      delete req.session.otpType;

      return res.json({
        success: true,
        redirectUrl: "/newpass",
      });
    }

    ///CURRENT EMAIL VERIFY 
    else if (otpType === "changeEmail") {

      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      delete req.session.otpType;

      return res.json({
        success: true,
        redirectUrl: "/change-new-email",
      });
    }

    //NEW EMAIL VERIFY 
    else if (otpType === "changenewEmail") {

      const { userId, newEmail } = req.session.changeNewEmail;

      await User.findByIdAndUpdate(userId, {
        email: newEmail,
        isVerified: true,
      });

      req.session.user.email = newEmail;

      delete req.session.userOtp;
      delete req.session.otpExpiresAt;
      delete req.session.otpType;
      delete req.session.changeNewEmail;

      return res.json({
        success: true,
        redirectUrl: "/profile",
      });
    }

  } catch (error) {
    console.log("Verify OTP Error:", error);
    return res.json({ success: false, message: "Server error" });
  }
};


//SET NEW PASSWORD
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


//profile password change
const updatePasswordProfile = async (req, res) => {
  try {
    const userId = req.session.user._id

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("user/resetPass", {
        error: "All fields are required",
      })
    }

    if (newPassword !== confirmPassword) {
      return res.render("user/resetPass", {
        error: "New passwords do not match",
      })
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.redirect("/login")
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isMatch) {
      return res.render("user/resetPass", {
        error: "Current password is incorrect",
      })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save()

    res.redirect("/profile");


  } catch (error) {
    console.log("Change password error:", error);
    res.redirect("/profile");
  }
}

//LOAD CHANGE EMAIL
const loadChangeEmail = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);

    res.render("user/emailVerify", {
      user,
      userEmail: user.email
    });

  } catch (error) {
    res.redirect("/profile");
  }
};

//OTP CHANGE EMAIL
const sendChangeEmailOtp = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const currentEmail = req.session.user.email;

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(currentEmail, otp);

    if (!emailSent) {
      return res.render("user/emailVerify", {
        user: req.session.user,
        userEmail: currentEmail,
        error: "Failed to send OTP",
      });
    }

    req.session.userOtp = otp;
    req.session.otpType = "changeEmail";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;

    res.redirect("/verify-otp");
  } catch (error) {
    console.log("Change email OTP error:", error);
    res.redirect("/profile");
  }
};


const loadChangenewEmail = async (req, res) => {
  try {
    const user = req.session.user;

    const email = user.email;
    const maskedEmail =
      email.slice(0, 2) + "****" + email.slice(email.indexOf("@"));

    res.render("user/changeEmail", {
      user: {
        ...user,
        maskedEmail,
      },
    });
  } catch (error) {
    console.log("Load change email error:", error);
    res.redirect("/profile");
  }
}

const sendChangenewEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.session.user._id;

    if (newEmail === req.session.user.email) {
      return res.render("user/changeEmail", {
        user: req.session.user,
        error: "Please enter a new email address",
      });
    }

    const emailExists = await User.findOne({
      email: newEmail,
      _id: { $ne: userId },
    });

    if (emailExists) {
      return res.render("user/changeEmail", {
        user: req.session.user,
        error: "Email already in use",
      });
    }

    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(newEmail, otp);
    if (!emailSent) {
      return res.render("user/changeEmail", {
        user: req.session.user,
        error: "Failed to send OTP",
      });
    }

    req.session.userOtp = otp;
    req.session.otpType = "changenewEmail";
    req.session.otpExpiresAt = Date.now() + 2 * 60 * 1000;
    req.session.changeNewEmail = { userId, newEmail };


    res.redirect("/verify-otp");

  } catch (error) {
    console.log("Change email OTP error:", error);
    res.redirect("/profile");
  }
};


//LOAD EDIT PROFILE
const loadEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id)

    res.render("user/editProfile", {
      user,
    })
  } catch (error) {
    res.redirect("/profile");
  }
}

//UPDATEPROFILE
const updateProfile = async (req, res) => {
  try {
    const { fullname, phone, gender, dob } = req.body;
    console.log(`${phone}`);


    const updatedUser = await User.findByIdAndUpdate(
      req.session.user._id,
      {
        fullname,
        phone,
        gender,
        dob,
      },
      { new: true }
    );


    req.session.user = updatedUser;

    return res.redirect("/profile");
  } catch (error) {
    console.log("Update error:", error);
    res.redirect("/edit-profile");
  }
};

//LOAD ADDRESS PAGE
const loadAddress = async (req, res) => {
  try {
    const addresses = await Address.find({
      userId: req.session.user._id
    });

    res.render("user/address", {
      user: req.session.user,
      addresses,
    });

  } catch (error) {
    console.log("LoadAddress Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

//ADD ADDRESS
const addAddress = async (req, res) => {
  try {
    const {
      fullname,
      phone,
      street,
      city,
      state,
      pincode,
      country,
      isDefault
    } = req.body;

    const userId = req.session.user._id;

    if (isDefault) {
      await Address.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    await Address.create({
      userId,
      fullname,
      phone,
      street,
      city,
      state,
      pincode,
      country,
      isDefault: !!isDefault
    });

    res.redirect("/address");

  } catch (error) {
    console.log("AddAddress Error:", error);
    res.redirect("/address");
  }
};


// UPDATE PASSWORD
const updateAddress = async (req, res) => {
  try {
    const {
      addressId,
      fullname,
      phone,
      street,
      city,
      state,
      pincode,
      country,
      isDefault
    } = req.body;

    const userId = req.session.user._id;

    if (isDefault) {
      await Address.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    await Address.findByIdAndUpdate(addressId, {
      fullname,
      phone,
      street,
      city,
      state,
      pincode,
      country,
      isDefault: !!isDefault
    });

    res.redirect("/address");

  } catch (error) {
    console.log("UpdateAddress Error:", error);
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
    console.log("Delete address error:", error);
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