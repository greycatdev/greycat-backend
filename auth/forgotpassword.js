import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../../models/User.js"; // adjust path if needed

const router = express.Router();

/* -------------------------------------------------
   FORGOT PASSWORD (SEND RESET LINK)
--------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({
        success: false,
        message: "Email is required",
      });
    }

    // Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: "No account found with this email",
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Save token + expiry
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Reset link (Frontend URL)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    /* -------------------------------------------------
       SEND EMAIL USING NODEMAILER
    --------------------------------------------------- */
    const transporter = nodemailer.createTransport({
      service: "gmail", // or "hotmail", "yahoo", "smtp"
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"GreyCat Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset Your GreyCat Password",
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your GreyCat account.</p>
        <p>Click the link below to reset your password:</p>
        
        <a href="${resetLink}" 
           style="padding: 10px 18px; background: #2f81f7; color: white; text-decoration:none; border-radius:6px;">
           Reset Password
        </a>

        <p>This link will expire in <strong>10 minutes</strong>.</p>

        <br/>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });

    return res.json({
      success: true,
      message: "Reset link sent to your email",
    });
  } catch (err) {
    console.log("FORGOT PASSWORD ERROR:", err);
    return res.json({
      success: false,
      message: "Something went wrong",
    });
  }
});

export default router;
