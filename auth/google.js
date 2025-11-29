import dotenv from "dotenv";
dotenv.config();

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        // ⭐ SAFE EMAIL HANDLING (prevents duplicate key crash)
        const email =
          profile.emails?.[0]?.value ||
          `google_${profile.id}@no-email.google.com`;

        const googlePhoto = profile.photos?.[0]?.value || "";
        const googleName = profile.displayName || "";

        // 1️⃣ Find user by googleId
        let user = await User.findOne({ googleId: profile.id });

        // 2️⃣ If not found, try email match
        if (!user) {
          user = await User.findOne({ email });
        }

        // 3️⃣ Create new user
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: googleName,
            email,
            photo: googlePhoto,
          });

          return done(null, user);
        }

        // 4️⃣ Update missing fields
        let updated = false;

        if (!user.googleId) {
          user.googleId = profile.id;
          updated = true;
        }

        if (!user.photo && googlePhoto) {
          user.photo = googlePhoto;
          updated = true;
        }

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
