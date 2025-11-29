import { Router } from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const router = Router();

/* -------------------------------------------------------
   ENV CONFIG
-------------------------------------------------------- */
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const LOGIN_URL = `${CLIENT_URL}/login`;
const SET_USERNAME_URL = `${CLIENT_URL}/set-username`;
const HOME_URL = `${CLIENT_URL}/`;

/* -------------------------------------------------------
   SMTP EMAIL SETUP — FIXED FOR RENDER + GMAIL
-------------------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // MUST be Gmail App Password
  },
});

// Check transporter status
transporter.verify((err, success) => {
  if (err) console.log("❌ Email Error:", err);
  else console.log("📧 Email server ready");
});


/* -------------------------------------------------------
   1️⃣ SIGNUP
-------------------------------------------------------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.json({ success: false, message: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.json({ success: false, message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashed,
      username: null,
    });

    return res.json({ success: true, message: "Account created" });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.json({ success: false, message: "Server error" });
  }
});


/* -------------------------------------------------------
   2️⃣ LOGIN
-------------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.json({ success: false, message: "Email & password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res.json({ success: false, message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.json({ success: false, message: "Incorrect password" });

    req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || null,
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
   3️⃣ FORGOT PASSWORD — FIXED
-------------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.json({ success: false, message: "Email required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.json({ success: false, message: "Email not found" });

    const token = crypto.randomBytes(32).toString("hex");

    await User.findByIdAndUpdate(user._id, {
      resetToken: token,
      resetTokenExpiry: Date.now() + 10 * 60 * 1000,
    });

    const resetLink = `${CLIENT_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: `"GreyCat Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset Your GreyCat Password",
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetLink}"
           style="padding:10px 18px;background:#2f81f7;color:white;text-decoration:none;border-radius:6px;">
           Reset Password
        </a>
        <p>This link expires in <strong>10 minutes</strong>.</p>
      `,
    });

    return res.json({ success: true, message: "Reset link sent" });

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
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: LOGIN_URL }),
  (req, res) => {
    req.session.save(() => {
      if (!req.user.username) return res.redirect(SET_USERNAME_URL);
      return res.redirect(HOME_URL);
    });
  }
);


/* -------------------------------------------------------
   6️⃣ GITHUB AUTH
-------------------------------------------------------- */
router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: LOGIN_URL }),
  (req, res) => {
    req.session.save(() => {
      if (!req.user.username) return res.redirect(SET_USERNAME_URL);
      return res.redirect(HOME_URL);
    });
  }
);


/* -------------------------------------------------------
   7️⃣ CHECK AUTH
-------------------------------------------------------- */
router.get("/user", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    return res.json({
      authenticated: true,
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        username: req.user.username || null,
      },
    });
  }

  if (req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
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
