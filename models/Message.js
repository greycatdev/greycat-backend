import mongoose from "mongoose";

/* -------------------------------------------------------
   REACTION SCHEMA (no _id for light documents)
-------------------------------------------------------- */
const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: false }
);

/* -------------------------------------------------------
   REPLY SCHEMA (thread replies)
-------------------------------------------------------- */
const replySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    edited: { type: Boolean, default: false },
  },
  { _id: false }
);

/* -------------------------------------------------------
   MAIN MESSAGE SCHEMA
-------------------------------------------------------- */
const messageSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // system messages allowed
    },

    text: {
      type: String,
      default: "",
      trim: true,
    },

    // URLs (images, files, code snippets, etc.)
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],

    reactions: [reactionSchema],

    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },

    edited: {
      type: Boolean,
      default: false,
    },

    // soft delete placeholder
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    replies: [replySchema],

    system: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

/* -------------------------------------------------------
   SAFE CHANNEL ACTIVITY UPDATE
   (post-save hook, non-blocking)
-------------------------------------------------------- */
messageSchema.post("save", async function () {
  try {
    const Channel = mongoose.model("Channel");

    await Channel.findByIdAndUpdate(this.channel, {
      lastActivity: new Date(),
    });
  } catch (err) {
    console.error("⚠️ Failed to update channel lastActivity:", err);
  }
});

/* -------------------------------------------------------
   SOFT DELETE (clean + safe)
-------------------------------------------------------- */
messageSchema.methods.softDelete = function () {
  this.text = "";
  this.attachments = [];
  this.reactions = [];
  this.deleted = true;

  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("Message", messageSchema);
