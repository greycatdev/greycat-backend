import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    /* ----------------------------------------------------
       BASIC EVENT DETAILS
    ---------------------------------------------------- */
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    location: { type: String, required: true },

    /* ----------------------------------------------------
       BANNER
       - stored as file URL (/uploads/events/...)
    ---------------------------------------------------- */
    bannerImage: {
      type: String,
      default: "/icons/default-event-banner.jpeg",
      trim: true,
    },

    /* ----------------------------------------------------
       HOST (USER WHO CREATED THE EVENT)
    ---------------------------------------------------- */
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ----------------------------------------------------
       ATTENDEES
    ---------------------------------------------------- */
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /* ----------------------------------------------------
       EVENT TYPE (online / offline)
    ---------------------------------------------------- */
    type: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
      index: true,
    },

    /* ----------------------------------------------------
       COMMENTS SECTION
       Each comment = text, user, createdAt
    ---------------------------------------------------- */
    comments: [
      {
        text: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/* ----------------------------------------------------
   METHOD → Add a new comment to event
   (Cleaner than pushing manually in controller)
---------------------------------------------------- */
eventSchema.methods.addComment = function (userId, text) {
  this.comments.push({
    text,
    user: userId,
    createdAt: new Date(),
  });

  return this.save({ validateBeforeSave: false });
};

/* ----------------------------------------------------
   METHOD → Add attendee safely (no duplicates)
---------------------------------------------------- */
eventSchema.methods.addAttendee = function (userId) {
  if (!this.attendees.includes(userId)) {
    this.attendees.push(userId);
  }
  return this.save({ validateBeforeSave: false });
};

/* ----------------------------------------------------
   METHOD → Remove attendee
---------------------------------------------------- */
eventSchema.methods.removeAttendee = function (userId) {
  this.attendees = this.attendees.filter(
    (att) => att.toString() !== userId.toString()
  );

  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("Event", eventSchema);
