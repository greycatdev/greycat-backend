import express from "express";
import Event from "../models/Event.js";
import { uploadPost } from "../utils/upload.js";

const router = express.Router();

/* ---------------------------------------------------------
   AUTH MIDDLEWARE
--------------------------------------------------------- */
function ensureAuth(req, res, next) {
  if (!req.user || !req.user._id) {
    return res
      .status(401)
      .json({ success: false, message: "Not logged in" });
  }
  next();
}

/* ---------------------------------------------------------
   CREATE EVENT
--------------------------------------------------------- */
router.post(
  "/create",
  ensureAuth,
  uploadPost.single("banner"),
  async (req, res) => {
    try {
      let bannerImage = req.body.bannerImage || "";

      // If file uploaded → convert path to correct URL format
      if (req.file) {
        bannerImage = req.file.path.replace(/\\/g, "/");
      }

      if (!bannerImage) {
        bannerImage = "/icons/default-event-banner.jpeg";
      }

      const event = await Event.create({
        title: req.body.title,
        description: req.body.description,
        date: req.body.date,
        location: req.body.location,
        type: req.body.type || "online",
        bannerImage,
        host: req.user._id,
      });

      return res.json({ success: true, event });
    } catch (err) {
      console.error("EVENT CREATE ERROR:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error" });
    }
  }
);

/* ---------------------------------------------------------
   GET ALL EVENTS
--------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("host", "username photo")
      .sort({ createdAt: -1 })
      .lean();

    const normalized = events.map((ev) => ({
      ...ev,
      bannerImage:
        ev.bannerImage || "/icons/default-event-banner.jpeg",
    }));

    return res.json({ success: true, events: normalized });
  } catch (err) {
    console.error("EVENT LIST ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   GET EVENT DETAILS (WITH COMMENTS)
--------------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("host", "username name photo")
      .populate("attendees", "username photo")
      .populate("comments.user", "username photo")
      .lean();

    if (!event) {
      return res.json({ success: false, message: "Event not found" });
    }

    event.bannerImage =
      event.bannerImage || "/icons/default-event-banner.jpeg";

    return res.json({ success: true, event });
  } catch (err) {
    console.error("EVENT DETAILS ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   JOIN / LEAVE EVENT
--------------------------------------------------------- */
router.post("/:id/join", ensureAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res.json({ success: false, message: "Event not found" });

    const userId = req.user._id;

    if (event.attendees.includes(userId)) {
      event.attendees.pull(userId); // leave
    } else {
      event.attendees.push(userId); // join
    }

    await event.save();

    return res.json({
      success: true,
      joined: event.attendees.includes(userId),
      attendeesCount: event.attendees.length,
    });
  } catch (err) {
    console.error("JOIN ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   ADD COMMENT
--------------------------------------------------------- */
router.post("/:id/comment", ensureAuth, async (req, res) => {
  try {
    const text = req.body.text?.trim();
    if (!text) {
      return res.json({ success: false, message: "Empty comment" });
    }

    const event = await Event.findById(req.params.id);
    if (!event)
      return res.json({ success: false, message: "Event not found" });

    event.comments.push({
      text,
      user: req.user._id,
      createdAt: new Date(),
    });

    await event.save();

    const updatedEvent = await Event.findById(req.params.id)
      .populate("host", "username photo")
      .populate("attendees", "username photo")
      .populate("comments.user", "username photo");

    return res.json({ success: true, event: updatedEvent });
  } catch (err) {
    console.error("COMMENT ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

/* ---------------------------------------------------------
   DELETE EVENT (ONLY HOST)
--------------------------------------------------------- */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res.json({ success: false, message: "Event not found" });

    if (event.host.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not allowed" });
    }

    await Event.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Event deleted" });
  } catch (err) {
    console.error("DELETE EVENT ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
