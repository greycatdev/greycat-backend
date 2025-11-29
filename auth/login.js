import express from "express";
import bcrypt from "bcrypt";
import User from "../../models/User.js"; // update path if needed

const router = express.Router();

/* -------------------------------------------------
   EMAIL + PASSWORD LOGIN
--------------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate fields
    if (!email || !password) {
      return res.json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // Compare passwords
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Store session
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
    };

    return res.json({
      success: true,
      message: "Login successful",
      user: req.session.user,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.json({
      success: false,
      message: "Internal server error",
    });
  }
});

/* -------------------------------------------------
   CHECK CURRENT LOGGED-IN USER
--------------------------------------------------- */
router.get("/user", async (req, res) => {
  try {
    if (req.session.user) {
      return res.json({
        authenticated: true,
        user: req.session.user,
      });
    }

    return res.json({
      authenticated: false,
    });
  } catch (err) {
    console.log("USER CHECK ERROR:", err);
    return res.json({
      authenticated: false,
    });
  }
});

/* -------------------------------------------------
   LOGOUT
--------------------------------------------------- */
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    return res.json({ success: true, message: "Logged out" });
  });
});

export default router;
