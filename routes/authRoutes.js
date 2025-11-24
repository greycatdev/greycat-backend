import { Router } from "express";
import passport from "passport";

const router = Router();

/* -------------------------------------------------------
   ENV CONFIG
-------------------------------------------------------- */
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const LOGIN_URL = `${CLIENT_URL}/login`;
const SET_USERNAME_URL = `${CLIENT_URL}/set-username`;
const HOME_URL = `${CLIENT_URL}/`;

/* -------------------------------------------------------
   1. GOOGLE AUTH
-------------------------------------------------------- */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: LOGIN_URL,
  }),
  (req, res) => {
    if (!req.user.username) {
      return res.redirect(SET_USERNAME_URL);
    }
    return res.redirect(HOME_URL);
  }
);

/* -------------------------------------------------------
   2. GITHUB AUTH
-------------------------------------------------------- */
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: LOGIN_URL,
  }),
  (req, res) => {
    if (!req.user.username) {
      return res.redirect(SET_USERNAME_URL);
    }
    return res.redirect(HOME_URL);
  }
);

/* -------------------------------------------------------
   3. CHECK LOGGED-IN USER
-------------------------------------------------------- */
router.get("/user", (req, res) => {
  if (req.isAuthenticated() && req.user) {
    return res.json({
      authenticated: true,
      user: req.user,
    });
  }

  return res.json({
    authenticated: false,
    user: null,
  });
});

/* -------------------------------------------------------
   4. LOGOUT — FULLY FIXED VERSION
-------------------------------------------------------- */
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.redirect(`${LOGIN_URL}?error=logout_failed`);
    }

    // remove existing session
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      return res.redirect(`${LOGIN_URL}?logout=success`);
    });
  });
});

export default router;
