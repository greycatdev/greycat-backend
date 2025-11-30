import express from "express";
import Channel from "../models/Channel.js";
import Message from "../models/Message.js";
import ensureAuth  from "../middlewares/ensureAuth.js";

const router = express.Router();

/* -----------------------------------------------------
   LIST PUBLIC CHANNELS
----------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const channels = await Channel.find({ isPrivate: false })
      .sort({ lastActivity: -1 })
      .select("name title description lastActivity members")
      .lean();

    return res.json({ success: true, channels });
  } catch (err) {
    console.error("List channels error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   GET CHANNEL DETAILS
----------------------------------------------------- */
router.get("/:id", async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate("members", "username name photo")
      .lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    return res.json({ success: true, channel });
  } catch (err) {
    console.error("Get channel error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   CREATE CHANNEL
----------------------------------------------------- */
router.post("/create", ensureAuth, async (req, res) => {
  try {
    const { name, title, description, isPrivate } = req.body;
    const finalName = (name || "").toLowerCase().trim();

    if (!finalName.match(/^[a-z0-9-_]+$/)) {
      return res.json({
        success: false,
        message: "Invalid channel name (use a-z0-9-_ only)",
      });
    }

    const exists = await Channel.findOne({ name: finalName });
    if (exists) {
      return res.json({ success: false, message: "Channel name taken" });
    }

    const userId = req.authUserId; // ⭐ unified auth

    const channel = await Channel.create({
      name: finalName,
      title: title || finalName,
      description: description || "",
      isPrivate: !!isPrivate,
      createdBy: userId,
      moderators: [userId],
      members: [userId],
    });

    return res.json({ success: true, channel });
  } catch (err) {
    console.error("Create channel error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   JOIN CHANNEL
----------------------------------------------------- */
router.post("/:id/join", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;

    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.json({ success: false, message: "Channel not found" });
    }

    if (!channel.members.includes(userId)) {
      channel.members.push(userId);
      await channel.save({ validateBeforeSave: false });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Join channel error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   LEAVE CHANNEL
----------------------------------------------------- */
router.post("/:id/leave", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;

    await Channel.findByIdAndUpdate(req.params.id, {
      $pull: { members: userId },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Leave channel error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   SEND MESSAGE
----------------------------------------------------- */
router.post("/:id/message", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;
    const { text, attachments } = req.body;
    const channelId = req.params.id;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.json({ success: false, message: "Channel not found" });
    }

    if (channel.isPrivate && !channel.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Private channel: join first",
      });
    }

    const message = await Message.create({
      channel: channelId,
      user: userId,
      text: text || "",
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    const msgPop = await Message.findById(message._id)
      .populate("user", "username name photo")
      .lean();

    const io = req.app.get("io");
    if (io) io.to(channelId).emit("new_message", msgPop);

    return res.json({ success: true, message: msgPop });
  } catch (err) {
    console.error("Send message error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   GET MESSAGES (paginated)
----------------------------------------------------- */
router.get("/:id/messages", async (req, res) => {
  try {
    const channelId = req.params.id;
    const limit = parseInt(req.query.limit || "50");
    const page = parseInt(req.query.page || "0");
    const skip = page * limit;

    const messages = await Message.find({ channel: channelId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "username name photo")
      .lean();

    return res.json({
      success: true,
      messages: messages.reverse(),
    });
  } catch (err) {
    console.error("Get messages error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   DELETE MESSAGE
----------------------------------------------------- */
router.delete("/message/:msgId", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;

    const msg = await Message.findById(req.params.msgId);
    if (!msg) {
      return res.json({ success: false, message: "Message not found" });
    }

    const channel = await Channel.findById(msg.channel);
    if (!channel) {
      return res.json({ success: false, message: "Channel not found" });
    }

    const isOwner = msg.user?.toString() === userId.toString();
    const isMod = channel.moderators.some(
      (m) => m.toString() === userId.toString()
    );

    if (!isOwner && !isMod) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await Message.findByIdAndDelete(msg._id);

    await Channel.findByIdAndUpdate(channel._id, {
      $pull: { messages: msg._id },
    });

    const io = req.app.get("io");
    if (io)
      io.to(channel._id.toString()).emit("message_deleted", {
        msgId: msg._id.toString(),
      });

    return res.json({ success: true, msgId: msg._id });
  } catch (err) {
    console.error("Delete message error:", err);
    return res.status(500).json({ success: false });
  }
});

/* -----------------------------------------------------
   REACTIONS
----------------------------------------------------- */
router.post("/message/:msgId/react", ensureAuth, async (req, res) => {
  try {
    const userId = req.authUserId;
    const { emoji } = req.body;

    if (!emoji) {
      return res.json({ success: false, message: "Missing emoji" });
    }

    const msg = await Message.findById(req.params.msgId);
    if (!msg) {
      return res.json({ success: false, message: "Message not found" });
    }

    const exists = msg.reactions.find(
      (r) => r.emoji === emoji && r.user.toString() === userId.toString()
    );

    if (exists) {
      msg.reactions = msg.reactions.filter(
        (r) =>
          !(
            r.emoji === emoji && r.user.toString() === userId.toString()
          )
      );
    } else {
      msg.reactions.push({ emoji, user: userId });
    }

    await msg.save();

    const msgPop = await Message.findById(msg._id)
      .populate("user", "username name photo")
      .lean();

    const io = req.app.get("io");
    if (io)
      io.to(msg.channel.toString()).emit("reaction_updated", msgPop);

    return res.json({ success: true, message: msgPop });
  } catch (err) {
    console.error("Reaction error:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
