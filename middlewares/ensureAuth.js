export default function ensureAuth(req, res, next) {
  const oauthUser = req.user?._id;
  const sessionUser = req.session.user?._id;

  if (!oauthUser && !sessionUser) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  req.authUserId = oauthUser || sessionUser;
  next();
}
