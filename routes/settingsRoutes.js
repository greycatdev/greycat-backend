import express from "express";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Project from "../models/Project.js";
import Event from "../models/Event.js";

const router = express.Router();

/* ---------------------------------------------------------
   AUTH MIDDLEWARE
--------------------------------------------------------- */
function ensureAuth(req, res, next) {
  if (!req.user?._id) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }
  next();
}

/* ---------------------------------------------------------
   GET SETTINGS
--------------------------------------------------------- */
router.get("/", ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name username email photo bio skills social location preferences privacy blockedUsers"
    );

    return res.json({ success: true, settings: user });
  } catch (err) {
    console.error("SETTINGS GET ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   UPDATE PROFILE  (FULLY FIXED)
--------------------------------------------------------- */
router.post("/profile", ensureAuth, async (req, res) => {
  try {
    const { name, username, bio, social, skills, location } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (social) updates.social = social;
    if (location) updates.location = location;

    /* ---- Skills normalization ---- */
    if (skills !== undefined) {
      updates.skills = Array.isArray(skills)
        ? skills.map((s) => s.toString().trim().toLowerCase())
        : skills
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
    }

    /* ---- Username validation ---- */
    if (username) {
      const final = username.trim().toLowerCase();

      if (!final.match(/^[a-z0-9._]+$/)) {
        return res.json({
          success: false,
          message: "Invalid username format",
        });
      }

      const exists = await User.findOne({
        username: final,
        _id: { $ne: req.user._id },
      });

      if (exists) {
        return res.json({
          success: false,
          message: "Username already taken",
        });
      }

      updates.username = final;
    }

    /* ---- UPDATE USER ---- */
    const updated = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    });

    /* ---------------------------------------------------
       IMPORTANT FIX: REFRESH PASSPORT SESSION
    --------------------------------------------------- */
    req.login(updated, (err) => {
      if (err) console.log("Session refresh failed:", err);
    });

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error("PROFILE UPDATE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   UPDATE PREFERENCES
--------------------------------------------------------- */
router.post("/preferences", ensureAuth, async (req, res) => {
  try {
    const { darkMode, showEmail, showProjects, notifications, language } =
      req.body;

    const user = await User.findById(req.user._id);
    if (!user.preferences) user.preferences = {};

    if (darkMode !== undefined) user.preferences.darkMode = !!darkMode;
    if (showEmail !== undefined) user.preferences.showEmail = !!showEmail;
    if (showProjects !== undefined) user.preferences.showProjects = !!showProjects;
    if (notifications) user.preferences.notifications = notifications;
    if (language) user.preferences.language = language;

    await user.save();

    return res.json({
      success: true,
      preferences: user.preferences,
    });
  } catch (err) {
    console.error("PREFERENCES UPDATE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   UPDATE PRIVACY
--------------------------------------------------------- */
router.post("/privacy", ensureAuth, async (req, res) => {
  try {
    const { privateProfile } = req.body;

    const user = await User.findById(req.user._id);
    user.privacy = { privateProfile: !!privateProfile };
    await user.save();

    return res.json({ success: true, privacy: user.privacy });
  } catch (err) {
    console.error("PRIVACY UPDATE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   BLOCK USER
--------------------------------------------------------- */
router.post("/block", ensureAuth, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.json({ success: false, message: "User ID required" });

    if (userId === req.user._id.toString()) {
      return res.json({
        success: false,
        message: "You cannot block yourself",
      });
    }

    const target = await User.findById(userId);
    if (!target) {
      return res.json({ success: false, message: "User not found" });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: userId },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("BLOCK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   UNBLOCK USER
--------------------------------------------------------- */
router.post("/unblock", ensureAuth, async (req, res) => {
  try {
    const { userId } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: userId },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("UNBLOCK ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   DELETE ACCOUNT
--------------------------------------------------------- */
router.delete("/delete", ensureAuth, async (req, res) => {
  try {
    const uid = req.user._id;

    await Post.deleteMany({ user: uid });
    await Project.deleteMany({ user: uid });
    await Event.deleteMany({ host: uid });

    await User.findByIdAndDelete(uid);

    req.logout((err) => {
      if (err) console.error("Logout error during delete:", err);
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Account deleted" });
    });
  } catch (err) {
    console.error("ACCOUNT DELETE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
