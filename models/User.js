import mongoose from "mongoose";

/* -------------------------------------------------------
   HELPERS → Normalize Data
-------------------------------------------------------- */
const normalizeSkills = (arr) =>
  arr.map((s) => s.trim().toLowerCase()).filter(Boolean);

const normalizeURL = (url) => (url ? url.trim() : "");

/* -------------------------------------------------------
   USER SCHEMA
-------------------------------------------------------- */
const userSchema = new mongoose.Schema(
  {
    /* ---------------------------------------------
       OAUTH PROVIDER IDS (Not unique for safety)
    --------------------------------------------- */
    googleId: { type: String, sparse: true, default: null },
    githubId: { type: String, sparse: true, default: null },

    /* ---------------------------------------------
       EMAIL LOGIN
    --------------------------------------------- */
    email: {
      type: String,
      required: true,
      unique: true,        // safe — emails always required
      trim: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      select: false,
    },

    resetToken: String,
    resetTokenExpiry: Date,

    /* ---------------------------------------------
       PUBLIC IDENTITY
    --------------------------------------------- */
    username: {
      type: String,
      unique: true,
      sparse: true,       // IMPORTANT → allows null without conflict
      trim: true,
      lowercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    photo: {
  type: String,
  default: "/default-image.jpg"
},



    bio: {
      type: String,
      default: "",
      trim: true,
    },

    skills: {
      type: [String],
      default: [],
      set: normalizeSkills,
    },

    /* ---------------------------------------------
       SOCIAL LINKS
    --------------------------------------------- */
    social: {
      github: { type: String, default: "", set: normalizeURL },
      linkedin: { type: String, default: "", set: normalizeURL },
      instagram: { type: String, default: "", set: normalizeURL },
      website: { type: String, default: "", set: normalizeURL },
      twitter: { type: String, default: "", set: normalizeURL },
      facebook: { type: String, default: "", set: normalizeURL },
    },

    /* ---------------------------------------------
       LOCATION INFO
    --------------------------------------------- */
    location: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      city: { type: String, default: "" },
    },

    /* ---------------------------------------------
       USER PREFERENCES
    --------------------------------------------- */
    preferences: {
      darkMode: { type: Boolean, default: false },
      showEmail: { type: Boolean, default: false },
      showProjects: { type: Boolean, default: true },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
    },

    /* ---------------------------------------------
       PRIVACY SETTINGS
    --------------------------------------------- */
    privacy: {
      privateProfile: { type: Boolean, default: false },
    },

    /* ---------------------------------------------
       BLOCKING SYSTEM
    --------------------------------------------- */
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /* ---------------------------------------------
       FOLLOWING SYSTEM
    --------------------------------------------- */
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

/* -------------------------------------------------------
   METHODS — Follow / Unfollow
-------------------------------------------------------- */
userSchema.methods.follow = function (userId) {
  if (!this.following.includes(userId)) {
    this.following.push(userId);
  }
  return this.save({ validateBeforeSave: false });
};

userSchema.methods.unfollow = function (userId) {
  this.following = this.following.filter(
    (id) => id.toString() !== userId.toString()
  );
  return this.save({ validateBeforeSave: false });
};

export default mongoose.model("User", userSchema);
