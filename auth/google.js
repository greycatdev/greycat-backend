import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

/* -------------------------------------------------------
   GOOGLE OAUTH STRATEGY — STABLE, RE-LOGIN SAFE
-------------------------------------------------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,        // ✅ FIXED
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || null;
        const photo = profile.photos?.[0]?.value || "";

        let user = await User.findOne({ googleId: profile.id });

        if (!user && email) {
          user = await User.findOne({ email });
        }

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: email,
            photo: photo,
          });
        } else {
          let updated = false;

          if (!user.googleId) {
            user.googleId = profile.id;
            updated = true;
          }

          if (photo && user.photo !== photo) {
            user.photo = photo;
            updated = true;
          }

          if (profile.displayName && user.name !== profile.displayName) {
            user.name = profile.displayName;
            updated = true;
          }

          if (updated) await user.save();
        }

        return done(null, user);
      } catch (error) {
        console.error("Google Auth Error:", error);
        return done(error, null);
      }
    }
  )
);


/* -------------------------------------------------------
   SESSION SERIALIZATION
-------------------------------------------------------- */
passport.serializeUser((user, done) => {
  done(null, user._id); // store only user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
});
