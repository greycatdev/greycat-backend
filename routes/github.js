import express from "express";
import axios from "axios";
import Project from "../models/Project.js";

const router = express.Router();

/* --------------------------------------------------------
   AUTH FIX → Works for new users and old users
--------------------------------------------------------- */
function getAuthUser(req) {
  return req.user || req.session.user || null;
}

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

    const headers = {
      "User-Agent": "GreyCat-App",
      Accept: "application/vnd.github+json",
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const { data } = await axios.get(url, { headers });

    const repos = data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || "",
      url: repo.html_url,
      language: repo.language?.trim().toLowerCase() || "unknown",
    }));

    return res.json({ success: true, repos });
  } catch (err) {
    const status = err.response?.status;
    console.log("GitHub API Error:", status);

    if (status === 404)
      return res.json({ success: false, message: "GitHub user not found" });

    if (status === 403)
      return res.json({
        success: false,
        message:
          "GitHub API rate limit exceeded. Add a GITHUB_TOKEN in backend env.",
      });

    return res.json({
      success: false,
      message: "Failed to fetch GitHub repositories",
    });
  }
});

/* --------------------------------------------------------
   2️⃣ IMPORT REPOS AS PROJECTS
--------------------------------------------------------- */
router.post("/import", async (req, res) => {
  try {
    const authUser = getAuthUser(req);

    if (!authUser?._id) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { repos } = req.body;

    if (!Array.isArray(repos) || repos.length === 0) {
      return res.json({
        success: false,
        message: "No repositories selected",
      });
    }

    const imported = [];

    for (let repo of repos) {
      const url = repo.url?.trim();
      if (!url) continue;

      // avoid duplicates
      const exists = await Project.findOne({
        user: authUser._id,
        link: url,
      }).lean();

      if (exists) continue;

      const project = await Project.create({
        user: authUser._id,
        title: repo.name,
        description: repo.description || "No description available",
        tech: [repo.language || "unknown"],
        link: url,
        image: "",
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
      message: "Failed to import GitHub projects",
    });
  }
});

export default router;
