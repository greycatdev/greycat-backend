import express from "express";
import bcrypt from "bcrypt";
import User from "../../models/User.js"; // adjust path if needed

const router = express.Router();

/* -------------------------------------------------
   USER SIGNUP (NAME, EMAIL, PASSWORD)
--------------------------------------------------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate
    if (!name || !email || !password) {
      return res.json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check existing user
    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.json({
      success: true,
      message: "Account created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
