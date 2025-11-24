import mongoose from "mongoose";

const channelSchema = new mongoose.Schema(
  {
    // unique channel identifier (e.g., "javascript", "web-dev")
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Human-friendly title
    title: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Private channels ≈ only invited users allowed
    isPrivate: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Members who joined the channel
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Moderators / admin permissions
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Channel creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Used to sort channels by activity
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

/* ---------------------------------------------------------
   IMPORTANT:
   Removed the pre("save") hook because:
   - it triggers on every save()
   - it may override intentional timestamps
   - can cause infinite loops if save triggers again
--------------------------------------------------------- */

/* ---------------------------------------------------------
   SAFE METHOD TO UPDATE ACTIVITY
   Call this manually whenever a message is created.
--------------------------------------------------------- */
channelSchema.methods.touchActivity = function () {
  this.lastActivity = new Date();
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("Channel", channelSchema);
