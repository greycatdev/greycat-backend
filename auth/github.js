import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------------------
   GITHUB AUTH STRATEGY — NON-OVERRIDING VERSION
-------------------------------------------------------- */
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ["user:email"],
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        // GitHub may hide email
        const email =
          profile.emails?.[0]?.value || null;

        const githubPhoto = profile.photos?.[0]?.value || "";
        const githubName = profile.displayName || profile.username;

        /* ----------------------------------------------------
           1. Find existing user by githubId
        ----------------------------------------------------- */
        let user = await User.findOne({ githubId: profile.id });

        /* ----------------------------------------------------
           2. Try find by email (cross-auth linking)
        ----------------------------------------------------- */
        if (!user && email) {
          user = await User.findOne({ email });
        }

        /* ----------------------------------------------------
           3. FIRST LOGIN → create user
        ----------------------------------------------------- */
        if (!user) {
          user = await User.create({
            githubId: profile.id,
            name: githubName,
            email,
            photo: githubPhoto,
          });

          return done(null, user);
        }

        /* ----------------------------------------------------
           4. EXISTING USER — DO NOT OVERRIDE CUSTOM DATA
           Only fill missing fields, never overwrite user changes.
        ----------------------------------------------------- */
        let updated = false;

        // Link GitHub ID if missing
        if (!user.githubId) {
          user.githubId = profile.id;
          updated = true;
        }

        // Only set GitHub photo if user never set their own
        if (!user.photo && githubPhoto) {
          user.photo = githubPhoto;
          updated = true;
        }

        // Only set name if user never edited it
        if (!user.name && githubName) {
          user.name = githubName;
          updated = true;
        }

        if (updated) await user.save();

        return done(null, user);
      } catch (err) {
        console.error("GitHub Auth Error:", err);
        return done(err, null);
      }
    }
  )
);

/* -------------------------------------------------------
   SESSION HANDLERS
-------------------------------------------------------- */
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
});
