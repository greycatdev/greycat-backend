import express from "express";
import User from "../models/User.js";
import { uploadProfile } from "../utils/upload.js";

const router = express.Router();

/* -----------------------------------------------------
   AUTH MIDDLEWARE
----------------------------------------------------- */
function ensureAuth(req, res, next) {
  if (!req.user?._id) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }
  next();
}

/* -----------------------------------------------------
   CHECK USERNAME EXISTS
------------------------------------------------------ */
router.get("/check-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    const exists = await User.findOne({ username }).lean();

    return res.json({ exists: !!exists });
  } catch (err) {
    console.error("CHECK USERNAME ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -----------------------------------------------------
   SET USERNAME (first-time setup)
------------------------------------------------------ */
router.post("/set-username", async (req, res) => {
  try {
    const { userId, username } = req.body;

    if (!username)
      return res.json({ success: false, message: "Username required" });

    const final = username.trim().toLowerCase();

    if (!final.match(/^[a-z0-9._]+$/)) {
      return res.json({
        success: false,
        message: "Invalid username format",
      });
    }

    const exists = await User.findOne({ username: final }).lean();
    if (exists) {
      return res.json({
        success: false,
        message: "Username already taken",
      });
    }

    await User.findByIdAndUpdate(userId, { username: final });

    return res.json({ success: true });
  } catch (err) {
    console.error("SET USERNAME ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   PUBLIC PROFILE BY USERNAME
------------------------------------------------------ */
router.get("/by-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    const user = await User.findOne({ username }).select(
      `
      username
      name
      email
      photo
      bio
      skills
      social
      location
      preferences
      privacy
      createdAt
      `
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error("PUBLIC PROFILE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   UPDATE LOGGED-IN USER (bio, skills, social, location)
------------------------------------------------------ */
router.put("/update", ensureAuth, async (req, res) => {
  try {
    const { bio, skills, social, location } = req.body;

    const updates = {};

    if (bio !== undefined) updates.bio = bio.trim();

    if (skills !== undefined) {
      updates.skills = Array.isArray(skills)
        ? skills.map((s) => s.trim().toLowerCase())
        : skills
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
    }

    if (social) updates.social = social;
    if (location) updates.location = location;

    const updated = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    }).select("username name photo bio skills social location");

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error("USER UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   UPLOAD PROFILE PICTURE (Cloudinary OR Local)
------------------------------------------------------ */
router.post(
  "/upload-photo",
  ensureAuth,
  uploadProfile.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.json({
          success: false,
          message: "No file uploaded",
        });
      }

      const imageURL =
        req.file.secure_url ||
        req.file.url ||
        req.file.path?.replace(/\\/g, "/");

      if (!imageURL) {
        return res.json({
          success: false,
          message: "Upload failed",
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { photo: imageURL },
        { new: true }
      ).select("photo");

      return res.json({
        success: true,
        photo: updatedUser.photo,
      });
    } catch (err) {
      console.error("UPLOAD PHOTO ERROR:", err);
      return res
        .status(500)
        .json({ success: false, message: "Upload failed" });
    }
  }
);

/* -----------------------------------------------------
   DELETE ACCOUNT (Fully Safe)
------------------------------------------------------ */
router.delete("/delete-account", ensureAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Delete user
    await User.findByIdAndDelete(userId);

    // 2. Destroy session
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid", {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
        });

        return res.json({
          success: true,
          message: "Account deleted successfully",
        });
      });
    });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
});


export default router;
