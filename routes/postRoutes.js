import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { uploadPost } from "../utils/upload.js";
import { ensureAuth } from "../middlewares/ensureAuth.js";

const router = express.Router();

/* ----------------------------------------------------
   FORMAT COMMENTS
---------------------------------------------------- */
async function populateComments(comments) {
  const userIds = comments.map((c) => c.user);
  const users = await User.find({ _id: { $in: userIds } })
    .select("username photo")
    .lean();

  return comments.map((c) => ({
    _id: c._id,
    text: c.text,
    createdAt: c.createdAt,
    user: users.find((u) => u._id.toString() === c.user.toString()),
  }));
}

/* ----------------------------------------------------
   FORMAT POST
---------------------------------------------------- */
async function formatPost(post, authUser) {
  const p = post.toObject();

  p.comments = await populateComments(p.comments);
  p.likesCount = p.likes.length;

  const currentId = authUser?._id?.toString();

  p.likedByCurrentUser = currentId
    ? p.likes.some((id) => id.toString() === currentId)
    : false;

  return p;
}

/* ----------------------------------------------------
   CREATE POST
---------------------------------------------------- */
router.post("/create", ensureAuth, uploadPost.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "Image required" });
    }

    const post = await Post.create({
      user: req.authUserId,
      image: req.file.path.replace(/\\/g, "/"),
      caption: req.body.caption?.trim() || "",
    });

    return res.json({ success: true, post });
  } catch (err) {
    console.error("POST CREATE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   HOME FEED
---------------------------------------------------- */
router.get("/feed", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", "username name photo");

    const authUser = req.session?.user || req.user || null;

    const formatted = await Promise.all(posts.map((p) => formatPost(p, authUser)));

    return res.json({ success: true, posts: formatted });
  } catch (err) {
    console.error("FEED ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   USER POSTS
---------------------------------------------------- */
router.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const profileUser = await User.findOne({ username });

    if (!profileUser) {
      return res.json({ success: false, message: "User not found" });
    }

    const posts = await Post.find({ user: profileUser._id })
      .sort({ createdAt: -1 })
      .populate("user", "username photo");

    const authUser = req.session?.user || req.user || null;

    const formatted = await Promise.all(posts.map((p) => formatPost(p, authUser)));

    return res.json({ success: true, posts: formatted });
  } catch (err) {
    console.error("USER POST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   SINGLE POST
---------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "user",
      "username name photo"
    );

    if (!post) return res.json({ success: false, message: "Post not found" });

    const authUser = req.session?.user || req.user;

    const formatted = await formatPost(post, authUser);

    return res.json({ success: true, post: formatted });
  } catch (err) {
    console.error("SINGLE POST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   LIKE / UNLIKE
---------------------------------------------------- */
router.post("/:id/like", ensureAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.json({ success: false, message: "Post not found" });

    const userId = req.authUserId.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(req.authUserId);
    }

    await post.save();

    return res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length,
    });
  } catch (err) {
    console.error("LIKE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   COMMENT
---------------------------------------------------- */
router.post("/:id/comment", ensureAuth, async (req, res) => {
  try {
    const text = req.body.text?.trim();

    if (!text) {
      return res.json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) return res.json({ success: false, message: "Post not found" });

    post.comments.push({
      user: req.authUserId,
      text,
      createdAt: new Date(),
    });

    await post.save();

    const populated = await populateComments(post.comments);

    return res.json({ success: true, comments: populated });
  } catch (err) {
    console.error("COMMENT ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   DELETE POST
---------------------------------------------------- */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.json({ success: false, message: "Post not found" });

    if (post.user.toString() !== req.authUserId.toString()) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    await post.deleteOne();

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
