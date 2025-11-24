import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------------------
   GITHUB OAUTH STRATEGY — STABLE, RE-LOGIN SAFE
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
        // GitHub may hide email (common issue)
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;

        const avatar = profile.photos?.[0]?.value || "";
        const displayName = profile.displayName || profile.username;

        /* ---------------------------------------------------
           1. Find existing user by GitHub ID
        ---------------------------------------------------- */
        let user = await User.findOne({ githubId: profile.id });

        /* ---------------------------------------------------
           2. If not found, check by email (cross-provider login)
        ---------------------------------------------------- */
        if (!user && email) {
          user = await User.findOne({ email });
        }

        /* ---------------------------------------------------
           3. If user does not exist → CREATE NEW USER
        ---------------------------------------------------- */
        if (!user) {
          user = await User.create({
            githubId: profile.id,
            name: displayName,
            email: email,
            photo: avatar,
          });
        } else {
          /* ---------------------------------------------------
             4. Update githubId if missing (first GitHub login)
          ---------------------------------------------------- */
          let updated = false;

          if (!user.githubId) {
            user.githubId = profile.id;
            updated = true;
          }

          /* ---------------------------------------------------
             5. Update user details if changed
          ---------------------------------------------------- */
          if (avatar && user.photo !== avatar) {
            user.photo = avatar;
            updated = true;
          }

          if (displayName && user.name !== displayName) {
            user.name = displayName;
            updated = true;
          }

          if (updated) await user.save();
        }

        return done(null, user);
      } catch (err) {
        console.error("GitHub Auth Error:", err);
        return done(err, null);
      }
    }
  )
);

/* -------------------------------------------------------
   SESSION SERIALIZATION
-------------------------------------------------------- */
passport.serializeUser((user, done) => {
  done(null, user._id); // store only user ID in cookie/session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
});
