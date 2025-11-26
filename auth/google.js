// config/passport.js
import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

/* -------------------------------------------------------
   GOOGLE AUTH STRATEGY — CLEAN, STABLE, NON-OVERRIDING
-------------------------------------------------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const googlePhoto = profile.photos?.[0]?.value || "";
        const googleName = profile.displayName || "";

        // 1️⃣ Check existing user by googleId
        let user = await User.findOne({ googleId: profile.id });

        // 2️⃣ If not found, try email match (handles users created before linking Google)
        if (!user && email) {
          user = await User.findOne({ email });
        }

        /* ----------------------------------------------------
           FIRST-TIME LOGIN → create a new user
        ----------------------------------------------------- */
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: googleName,
            email: email,
            photo: googlePhoto,
          });

          return done(null, user);
        }

        /* ----------------------------------------------------
           EXISTING USER → DO NOT OVERRIDE MANUAL UPDATES
           Only fill missing fields, never overwrite them.
        ----------------------------------------------------- */
        let updated = false;

        // Attach Google ID if missing (account linking)
        if (!user.googleId) {
          user.googleId = profile.id;
          updated = true;
        }

        // Only assign Google photo if the user hasn't set a custom one
        if (!user.photo && googlePhoto) {
          user.photo = googlePhoto;
          updated = true;
        }

        // Only assign Google display name if empty
        if (!user.name && googleName) {
          user.name = googleName;
          updated = true;
        }

        if (updated) await user.save();

        return done(null, user);
      } catch (error) {
        console.error("Google Auth Error:", error);
        return done(error, null);
      }
    }
  )
);

/* -------------------------------------------------------
   PASSPORT SESSION HANDLERS
-------------------------------------------------------- */
passport.serializeUser((user, done) => {
  done(null, user._id); 
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
});
