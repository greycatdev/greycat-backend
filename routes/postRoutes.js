import express from "express";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { uploadPost } from "../utils/upload.js";

const router = express.Router();

/* ----------------------------------------------------
   AUTH CHECK
---------------------------------------------------- */
function ensureAuth(req, res, next) {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  next();
}

/* ----------------------------------------------------
   FORMAT COMMENTS (FAST)
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
async function formatPost(post, currentUser) {
  const p = post.toObject();

  p.comments = await populateComments(p.comments);
  p.likesCount = p.likes.length;
  p.likedByCurrentUser = currentUser
    ? p.likes.some((id) => id.toString() === currentUser._id.toString())
    : false;

  return p;
}

/* ----------------------------------------------------
   CREATE POST
---------------------------------------------------- */
router.post("/create", ensureAuth, uploadPost.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "Image upload required" });
    }

    const post = await Post.create({
      user: req.user._id,
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

    const formatted = await Promise.all(posts.map((p) => formatPost(p, req.user)));

    return res.json({ success: true, posts: formatted });
  } catch (err) {
    console.error("FEED ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   USER POSTS (PROFILE PAGE)
---------------------------------------------------- */
router.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("user", "username photo");

    const formatted = await Promise.all(posts.map((p) => formatPost(p, req.user)));

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

    const formatted = await formatPost(post, req.user);

    return res.json({ success: true, post: formatted });
  } catch (err) {
    console.error("SINGLE POST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   EXPLORE RANDOM POSTS
---------------------------------------------------- */
router.get("/explore/random", async (req, res) => {
  try {
    const posts = await Post.aggregate([{ $sample: { size: 40 } }]);

    const withUsers = await Promise.all(
      posts.map(async (p) => ({
        ...p,
        user: await User.findById(p.user).select("username photo").lean(),
      }))
    );

    return res.json({ success: true, posts: withUsers });
  } catch (err) {
    console.error("EXPLORE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ----------------------------------------------------
   LIKE / UNLIKE POST
---------------------------------------------------- */
router.post("/:id/like", ensureAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.json({ success: false, message: "Post not found" });

    const userId = req.user._id.toString();
    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(req.user._id);
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
   ADD COMMENT
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
      user: req.user._id,
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
   DELETE POST (OWNER ONLY)
---------------------------------------------------- */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.json({ success: false, message: "Post not found" });

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await post.deleteOne();

    return res.json({ success: true, message: "Post deleted" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
