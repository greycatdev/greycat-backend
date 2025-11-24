import express from "express";
import User from "../models/User.js";

const router = express.Router();

/* ---------------------------------------------------
   AUTH CHECK
--------------------------------------------------- */
function ensureAuth(req, res, next) {
  if (!req.user || !req.user._id)
    return res
      .status(401)
      .json({ success: false, message: "Not logged in" });

  next();
}

/* ---------------------------------------------------
   FOLLOW USER
--------------------------------------------------- */
router.post("/follow/:username", ensureAuth, async (req, res) => {
  try {
    const target = await User.findOne({
      username: req.params.username.toLowerCase(),
    });

    if (!target)
      return res.json({ success: false, message: "User not found" });

    if (target._id.equals(req.user._id))
      return res.json({
        success: false,
        message: "You cannot follow yourself",
      });

    const me = await User.findById(req.user._id);

    if (me.following.includes(target._id))
      return res.json({
        success: false,
        message: "Already following",
      });

    // follow
    me.following.push(target._id);
    target.followers.push(me._id);

    await me.save({ validateBeforeSave: false });
    await target.save({ validateBeforeSave: false });

    return res.json({ success: true });
  } catch (err) {
    console.error("Follow error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------
   UNFOLLOW USER
--------------------------------------------------- */
router.post("/unfollow/:username", ensureAuth, async (req, res) => {
  try {
    const target = await User.findOne({
      username: req.params.username.toLowerCase(),
    });

    if (!target)
      return res.json({ success: false, message: "User not found" });

    const me = await User.findById(req.user._id);

    me.following = me.following.filter(
      (id) => id.toString() !== target._id.toString()
    );
    target.followers = target.followers.filter(
      (id) => id.toString() !== me._id.toString()
    );

    await me.save({ validateBeforeSave: false });
    await target.save({ validateBeforeSave: false });

    return res.json({ success: true });
  } catch (err) {
    console.error("Unfollow error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------
   CHECK FOLLOW STATUS
--------------------------------------------------- */
router.get("/status/:username", async (req, res) => {
  try {
    if (!req.user)
      return res.json({ success: true, following: false });

    const target = await User.findOne({
      username: req.params.username.toLowerCase(),
    });

    if (!target)
      return res.json({ success: false });

    const me = await User.findById(req.user._id);

    const isFollowing = me.following.includes(target._id);

    return res.json({ success: true, following: isFollowing });
  } catch (err) {
    console.error("Follow status error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------
   GET FOLLOWERS LIST
--------------------------------------------------- */
router.get("/followers/:username", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username.toLowerCase(),
    })
      .populate("followers", "username name photo")
      .lean();

    if (!user)
      return res.json({ success: false, followers: [] });

    return res.json({ success: true, followers: user.followers });
  } catch (err) {
    console.error("Followers list error:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------
   GET FOLLOWING LIST
--------------------------------------------------- */
router.get("/following/:username", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username.toLowerCase(),
    })
      .populate("following", "username name photo")
      .lean();

    if (!user)
      return res.json({ success: false, following: [] });

    return res.json({ success: true, following: user.following });
  } catch (err) {
    console.error("Following list error:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
