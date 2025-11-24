import mongoose from "mongoose";

/* -------------------------------------------------------
   COMMENT SUB-SCHEMA
-------------------------------------------------------- */
const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* -------------------------------------------------------
   MAIN POST SCHEMA
-------------------------------------------------------- */
const postSchema = new mongoose.Schema(
  {
    // Post owner
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Image URL (stored in /uploads or cloud)
    image: {
      type: String,
      required: true,
      trim: true,
    },

    // Caption (optional)
    caption: {
      type: String,
      default: "",
      trim: true,
    },

    /* ----------------------------------------------------
       ❤️ Likes
       Array of User IDs → prevents duplicates easily
    ---------------------------------------------------- */
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /* ----------------------------------------------------
       💬 Comments
    ---------------------------------------------------- */
    comments: [commentSchema],
  },
  { timestamps: true }
);

/* -------------------------------------------------------
   METHOD: Add a like (prevents duplicates)
-------------------------------------------------------- */
postSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
  }
  return this.save({ validateBeforeSave: false });
};

/* -------------------------------------------------------
   METHOD: Remove like
-------------------------------------------------------- */
postSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(
    (id) => id.toString() !== userId.toString()
  );
  return this.save({ validateBeforeSave: false });
};

/* -------------------------------------------------------
   METHOD: Add comment
-------------------------------------------------------- */
postSchema.methods.addComment = function (userId, text) {
  this.comments.push({
    user: userId,
    text,
    createdAt: new Date(),
  });

  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("Post", postSchema);
