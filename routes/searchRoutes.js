import express from "express";
import User from "../models/User.js";
import Event from "../models/Event.js";

const router = express.Router();

/* -------------------------------------------------------
   GLOBAL SEARCH — users + events
   /search?q=keyword
------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const q = req.query.q?.trim();

    // if query empty → empty result set
    if (!q) {
      return res.json({ success: true, users: [], events: [] });
    }

    // Escape regex special chars to prevent injection
    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safeQuery, "i");

    /* ----------------------------
       USER SEARCH
    ---------------------------- */
    const users = await User.find({
      $or: [{ username: regex }, { name: regex }],
    })
      .select("name username photo")
      .lean();

    /* ----------------------------
       EVENT SEARCH
    ---------------------------- */
    const events = await Event.find({
      $or: [{ title: regex }, { location: regex }],
    })
      .select("title location date bannerImage")
      .lean();

    return res.json({ success: true, users, events });
    
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
