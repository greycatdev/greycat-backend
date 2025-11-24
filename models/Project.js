import mongoose from "mongoose";

/* -------------------------------------------------------
   PROJECT SCHEMA
-------------------------------------------------------- */
const projectSchema = new mongoose.Schema(
  {
    // Owner
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Title
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Description
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Tech stack
    tech: {
      type: [String],
      default: [],
      set: (arr) => arr.map((t) => t.trim().toLowerCase()), // normalized tags
    },

    // Optional project link
    link: {
      type: String,
      default: "",
      trim: true,
    },

    // Screenshot / thumbnail
    image: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

/* -------------------------------------------------------
   OPTIONAL METHODS (makes controllers cleaner)
-------------------------------------------------------- */
projectSchema.methods.updateImage = function (url) {
  this.image = url;
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("Project", projectSchema);
