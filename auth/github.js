import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

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
        const githubId = profile.id;
        const githubPhoto = profile.photos?.[0]?.value || "";
        const githubName = profile.displayName || profile.username;

        // ⭐ SAFEST EMAIL HANDLING
        const email =
          profile.emails?.[0]?.value ||
          `github_${githubId}@no-email.github.com`;

        // 1️⃣ Try find by GitHub ID
        let user = await User.findOne({ githubId });

        // 2️⃣ If not found, try find by email (same person)
        if (!user) {
          user = await User.findOne({ email });
        }

        // 3️⃣ Create new user
        if (!user) {
          user = await User.create({
            githubId,
            name: githubName,
            email,
            photo: githubPhoto,
          });

          return done(null, user);
        }

        // 4️⃣ Update missing fields
        let updated = false;

        if (!user.githubId) {
          user.githubId = githubId;
          updated = true;
        }

        if (!user.photo && githubPhoto) {
          user.photo = githubPhoto;
          updated = true;
        }

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
