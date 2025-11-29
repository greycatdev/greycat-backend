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

        const email =
          profile.emails?.[0]?.value || null;

        const githubPhoto = profile.photos?.[0]?.value || "";
        const githubName = profile.displayName || profile.username;

  
        let user = await User.findOne({ githubId: profile.id });


        if (!user && email) {
          user = await User.findOne({ email });
        }

        if (!user) {
          user = await User.create({
            githubId: profile.id,
            name: githubName,
            email,
            photo: githubPhoto,
          });

          return done(null, user);
        }

        let updated = false;

        if (!user.githubId) {
          user.githubId = profile.id;
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
