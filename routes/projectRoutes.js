import express from "express";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { uploadProject } from "../utils/upload.js";

const router = express.Router();

/* ------------------------------------------------------------
   AUTH MIDDLEWARE
------------------------------------------------------------ */
function ensureAuth(req, res, next) {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  next();
}

/* ------------------------------------------------------------
   CREATE PROJECT
------------------------------------------------------------ */
router.post("/create", ensureAuth, uploadProject.single("image"), async (req, res) => {
  try {
    const { title, description, tech, link } = req.body;

    const project = await Project.create({
      user: req.user._id,
      title: title?.trim(),
      description: description?.trim() || "",
      tech: tech
        ? tech.split(",").map((t) => t.trim().toLowerCase())
        : [],
      link: link?.trim() || "",
      image: req.file ? req.file.path.replace(/\\/g, "/") : "",
    });

    return res.json({ success: true, project });
  } catch (err) {
    console.error("PROJECT CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ------------------------------------------------------------
   GET SINGLE PROJECT BY ID
------------------------------------------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("user", "username photo");

    if (!project)
      return res.json({ success: false, message: "Project not found" });

    return res.json({ success: true, project });
  } catch (err) {
    console.error("PROJECT FETCH ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ------------------------------------------------------------
   GET ALL PROJECTS OF A USER
------------------------------------------------------------ */
router.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });

    if (!user)
      return res.json({ success: false, message: "User not found" });

    const projects = await Project.find({ user: user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, projects });
  } catch (err) {
    console.error("PROJECT USER LIST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ------------------------------------------------------------
   DELETE PROJECT (OWNER ONLY)
------------------------------------------------------------ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project)
      return res.json({ success: false, message: "Project not found" });

    if (project.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await project.deleteOne();

    return res.json({ success: true, message: "Project deleted" });
  } catch (err) {
    console.error("PROJECT DELETE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
