import { Router } from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const router = Router();

/* -------------------------------------------------------
   ENV / CONSTANTS
-------------------------------------------------------- */
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const LOGIN_URL = `${CLIENT_URL}/login`;
const SET_USERNAME_URL = `${CLIENT_URL}/set-username`;
const HOME_URL = `${CLIENT_URL}/`;

/* -------------------------------------------------------
   DEFAULT PHOTO
-------------------------------------------------------- */
const DEFAULT_PHOTO = "/default-image.jpg";

/* -------------------------------------------------------
   EMAIL SENDER
-------------------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* -------------------------------------------------------
   1️⃣ SIGNUP
-------------------------------------------------------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.json({ success: false, message: "All fields are required" });

    const cleanEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: cleanEmail });
    if (exists)
      return res.json({ success: false, message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email: cleanEmail,
      password: hashed,
      username: null,
      photo: DEFAULT_PHOTO,
    });

    return res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------
   2️⃣ LOGIN (Email + Password)
   🔥 FIX: We attach req.user = user manually
-------------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.json({ success: false, message: "Email & password required" });

    const user = await User.findOne({ email }).select("+password");

    if (!user) return res.json({ success: false, message: "User not found" });
    if (!user.password)
      return res.json({
        success: false,
        message: "This account uses Google/Github login.",
      });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.json({ success: false, message: "Incorrect password" });

    const finalPhoto = user.photo || DEFAULT_PHOTO;

    // Create session
    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      photo: finalPhoto,
      updatedAt: user.updatedAt,
    };

    // ⭐ CRITICAL FIX — make backend routes work
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      photo: finalPhoto,
    };

    return res.json({
      success: true,
      message: "Login successful",
      user: req.session.user,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------
   3️⃣ FORGOT PASSWORD
-------------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Email not found" });

    if (!user.password)
      return res.json({
        success: false,
        message: "This account uses Google/Github login.",
      });

    const token = crypto.randomBytes(32).toString("hex");

    await User.findByIdAndUpdate(user._id, {
      resetToken: token,
      resetTokenExpiry: Date.now() + 1000 * 60 * 10,
    });

    const link = `${CLIENT_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"GreyCat Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset Your GreyCat Password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${link}"
           style="padding:12px 20px;background:#2f81f7;color:white;border-radius:6px;text-decoration:none;">
           Reset Password
        </a>
        <p>This link expires in 10 minutes.</p>
      `,
    });

    return res.json({ success: true, message: "Reset link sent to email" });
  } catch (err) {
    console.error("FORGOT ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------
   4️⃣ RESET PASSWORD
-------------------------------------------------------- */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password)
      return res.json({ success: false, message: "Password required" });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user)
      return res.json({ success: false, message: "Invalid or expired link" });

    const hashed = await bcrypt.hash(password, 10);

    await User.findByIdAndUpdate(user._id, {
      password: hashed,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    return res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("RESET ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
});

/* -------------------------------------------------------
   5️⃣ GOOGLE AUTH
-------------------------------------------------------- */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: LOGIN_URL }),
  async (req, res) => {
    const finalPhoto = req.user.photo || DEFAULT_PHOTO;

    req.session.user = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      username: req.user.username || null,
      photo: finalPhoto,
      updatedAt: req.user.updatedAt,
    };

    req.session.save(() => {
      if (!req.user.username) return res.redirect(SET_USERNAME_URL);
      return res.redirect(HOME_URL);
    });
  }
);

/* -------------------------------------------------------
   6️⃣ GITHUB AUTH
-------------------------------------------------------- */
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: LOGIN_URL }),
  async (req, res) => {
    const finalPhoto = req.user.photo || DEFAULT_PHOTO;

    req.session.user = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      username: req.user.username || null,
      photo: finalPhoto,
      updatedAt: req.user.updatedAt,
    };

    req.session.save(() => {
      if (!req.user.username) return res.redirect(SET_USERNAME_URL);
      return res.redirect(HOME_URL);
    });
  }
);

/* -------------------------------------------------------
   7️⃣ AUTH CHECK
-------------------------------------------------------- */
router.get("/user", (req, res) => {
  if (req.session.user)
    return res.json({ authenticated: true, user: req.session.user });

  if (req.isAuthenticated() && req.user) {
    const finalPhoto = req.user.photo || DEFAULT_PHOTO;

    return res.json({
      authenticated: true,
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        username: req.user.username || null,
        photo: finalPhoto,
        updatedAt: req.user.updatedAt,
      },
    });
  }

  return res.json({ authenticated: false, user: null });
});

/* -------------------------------------------------------
   8️⃣ LOGOUT
-------------------------------------------------------- */
router.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      return res.redirect(`${LOGIN_URL}?logout=success`);
    });
  });
});

export default router;
