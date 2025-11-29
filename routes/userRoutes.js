import express from "express";
import User from "../models/User.js";
import { uploadProfile } from "../utils/upload.js";

const router = express.Router();

/* -----------------------------------------------------
   AUTH MIDDLEWARE (OAuth + Session Safe)
----------------------------------------------------- */
function ensureAuth(req, res, next) {
  const oauthUser = req.user?.id || req.user?._id;
  const sessionUser = req.session.user?._id;

  if (!oauthUser && !sessionUser) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  req.authUserId = oauthUser || sessionUser;
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
   SET USERNAME — ONE TIME ONLY
------------------------------------------------------ */
router.post("/set-username", async (req, res) => {
  try {
    const { userId, username } = req.body;

    if (!userId || !username)
      return res.json({ success: false, message: "Missing fields" });

    const final = username.trim().toLowerCase();

    if (!final.match(/^[a-z0-9._]+$/)) {
      return res.json({
        success: false,
        message: "Only letters, numbers, . and _ allowed",
      });
    }

    const user = await User.findById(userId).lean();

    if (!user)
      return res.json({ success: false, message: "User not found" });

    // ❗ DO NOT ALLOW CHANGING USERNAME IF ALREADY SET
    if (user.username) {
      return res.json({
        success: false,
        message: "Username already set — cannot change",
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

    // Update session
    if (req.session.user) {
      req.session.user.username = final;
      await req.session.save();
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("SET USERNAME ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   PUBLIC PROFILE (Email hidden!)
------------------------------------------------------ */
router.get("/by-username/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    const user = await User.findOne({ username })
      .select("username name photo bio skills social location preferences privacy createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({ success: true, user });

  } catch (err) {
    console.error("PUBLIC PROFILE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   UPDATE PROFILE (Merge instead of overwrite)
------------------------------------------------------ */
router.put("/update", ensureAuth, async (req, res) => {
  try {
    const { bio, skills, social, location } = req.body;

    const updates = {};

    if (bio !== undefined) updates.bio = bio.trim();

    if (skills !== undefined) {
      updates.skills = Array.isArray(skills)
        ? skills.map((s) => s.trim().toLowerCase())
        : skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    }

    // Merge social links
    if (social) updates.social = { ...social };

    // Merge location
    if (location) updates.location = { ...location };

    updates.updatedAt = Date.now();

    const updated = await User.findByIdAndUpdate(req.authUserId, updates, {
      new: true,
    }).select("username name photo bio skills social location updatedAt");

    return res.json({ success: true, user: updated });

  } catch (err) {
    console.error("USER UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -----------------------------------------------------
   UPLOAD PROFILE PHOTO
------------------------------------------------------ */
router.post(
  "/upload-photo",
  ensureAuth,
  uploadProfile.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.json({ success: false, message: "No file uploaded" });
      }

      const imageURL =
        req.file.path || req.file.secure_url || req.file.url;

      if (!imageURL) {
        return res.json({ success: false, message: "Upload failed" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.authUserId,
        { photo: imageURL, updatedAt: Date.now() },
        { new: true }
      ).select("photo updatedAt");

      return res.json({ success: true, photo: updatedUser.photo });

    } catch (err) {
      console.error("UPLOAD PHOTO ERROR:", err);
      return res.status(500).json({
        success: false,
        message: "Upload failed",
      });
    }
  }
);

/* -----------------------------------------------------
   DELETE ACCOUNT
------------------------------------------------------ */
router.delete("/delete-account", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;

    await User.findByIdAndDelete(userId);

    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid", {
          httpOnly: true,
          secure: true,
          sameSite: "none",
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
