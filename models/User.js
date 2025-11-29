import mongoose from "mongoose";

/* -------------------------------------------------------
   HELPERS → Normalizing Data
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
       AUTH IDs (OAuth Providers)
    --------------------------------------------- */
    googleId: { type: String, unique: false, sparse: true },
    githubId: { type: String, unique: false, sparse: true },

    /* ---------------------------------------------
       EMAIL + PASSWORD AUTH
    --------------------------------------------- */
    password: {
      type: String,
      select: false,
    },

    resetToken: { type: String },
    resetTokenExpiry: { type: Date },

    /* ---------------------------------------------
       PROFILE INFO
    --------------------------------------------- */
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    photo: {
      type: String,
      default: "",
      trim: true,
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
    },

    /* ---------------------------------------------
       LOCATION
    --------------------------------------------- */
    location: {
      country: { type: String, default: "", trim: true },
      state: { type: String, default: "", trim: true },
      district: { type: String, default: "", trim: true },
      city: { type: String, default: "", trim: true },
    },

    /* ---------------------------------------------
       PREFERENCES
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
       BLOCKED USERS
    --------------------------------------------- */
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /* ---------------------------------------------
       FOLLOWERS / FOLLOWING
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
   METHODS — FOLLOW / UNFOLLOW
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
