import express from "express";
import axios from "axios";
import Project from "../models/Project.js";

const router = express.Router();

/* --------------------------------------------------------
   1️⃣ FETCH PUBLIC GITHUB REPOS
--------------------------------------------------------- */
router.get("/repos/:username", async (req, res) => {
  try {
    const username = req.params.username?.trim().toLowerCase();

    if (!username) {
      return res.json({ success: false, message: "Username required" });
    }

    const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "GreyCat-App",
        Accept: "application/vnd.github+json",
      },
    });

    const repos = data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || "",
      url: repo.html_url,
      language: repo.language?.trim() || "unknown",
    }));

    return res.json({ success: true, repos });
  } catch (err) {
    const status = err.response?.status;
    console.log("GitHub Fetch Error:", status);

    if (status === 404)
      return res.json({ success: false, message: "GitHub user not found" });

    if (status === 403)
      return res.json({
        success: false,
        message: "GitHub rate limit exceeded. Try again later.",
      });

    return res.json({
      success: false,
      message: "Failed to fetch GitHub data",
    });
  }
});

/* --------------------------------------------------------
   2️⃣ IMPORT SELECTED PROJECTS (ONLY IF LOGGED-IN)
--------------------------------------------------------- */
router.post("/import", async (req, res) => {
  try {
    if (!req.user?._id) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { repos } = req.body;

    if (!Array.isArray(repos) || repos.length === 0) {
      return res.json({
        success: false,
        message: "No repositories provided",
      });
    }

    const imported = [];

    for (let repo of repos) {
      const repoURL = repo.url?.trim();
      if (!repoURL) continue;

      // Prevent duplicates
      const exists = await Project.findOne({
        user: req.user._id,
        link: repoURL,
      }).lean();

      if (exists) continue;

      const project = await Project.create({
        user: req.user._id,
        title: repo.name,
        description: repo.description || "No description available",
        tech: [
          repo.language?.trim().toLowerCase() || "unknown",
        ],
        link: repoURL,
        image: "", // placeholder
      });

      imported.push(project);
    }

    return res.json({
      success: true,
      importedCount: imported.length,
      message: "Projects imported successfully",
    });
  } catch (err) {
    console.error("GitHub Import Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to import projects",
    });
  }
});

export default router;
