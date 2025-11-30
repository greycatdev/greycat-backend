import express from "express";
import { uploadEventBanner } from "../utils/upload.js";
import { ensureAuth } from "../middlewares/ensureAuth.js";

const router = express.Router();

/* ---------------------------------------------------------
   UPLOAD EVENT BANNER (AUTH REQUIRED)
--------------------------------------------------------- */
router.post(
  "/banner",
  ensureAuth,
  uploadEventBanner.single("banner"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Normalize path (Render gives Linux-style paths)
      let fileUrl =
        req.file.secure_url ||
        req.file.url ||
        req.file.path?.replace(/\\/g, "/");

      if (!fileUrl) {
        return res.json({
          success: false,
          message: "Upload failed",
        });
      }

      // Ensure URL is absolute
      if (!fileUrl.startsWith("http")) {
        fileUrl = `${process.env.BACKEND_URL}/${fileUrl}`;
      }

      return res.json({
        success: true,
        url: fileUrl,
      });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      return res.status(500).json({
        success: false,
        message: "Upload failed",
      });
    }
  }
);

export default router;
