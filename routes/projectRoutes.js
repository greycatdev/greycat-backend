import express from "express";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { uploadProject } from "../utils/upload.js";
import { ensureAuth } from "../middlewares/ensureAuth.js";

const router = express.Router();

/* ------------------------------------------------------------
   CREATE PROJECT
------------------------------------------------------------ */
router.post(
  "/create",
  ensureAuth,
  uploadProject.single("image"),
  async (req, res) => {
    try {
      const { title, description, tech, link } = req.body;

      const project = await Project.create({
        user: req.authUserId,
        title: title?.trim(),
        description: description?.trim() || "",
        tech: tech ? tech.split(",").map((t) => t.trim().toLowerCase()) : [],
        link: link?.trim() || "",
        image: req.file ? req.file.path.replace(/\\/g, "/") : "",
      });

      return res.json({ success: true, project });
    } catch (err) {
      console.error("PROJECT CREATE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* ------------------------------------------------------------
   GET SINGLE PROJECT
------------------------------------------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "user",
      "username photo"
    );

    if (!project)
      return res.json({ success: false, message: "Project not found" });

    return res.json({ success: true, project });
  } catch (err) {
    console.error("PROJECT FETCH ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ------------------------------------------------------------
   GET ALL PROJECTS FOR A USER
------------------------------------------------------------ */
router.get("/user/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });

    if (!user) return res.json({ success: false, message: "User not found" });

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
   DELETE PROJECT (OWNER)
------------------------------------------------------------ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project)
      return res.json({ success: false, message: "Project not found" });

    if (project.user.toString() !== req.authUserId.toString()) {
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

/* ------------------------------------------------------------
   GET PROJECTS FOR LOGGED-IN USER
------------------------------------------------------------ */
router.get("/mine", ensureAuth, async (req, res) => {
  try {
    const projects = await Project.find({ user: req.authUserId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, projects });
  } catch (err) {
    console.error("PROJECT FETCH MINE ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
