import express from "express";
import { uploadEventBanner } from "../utils/upload.js";

const router = express.Router();

/* ---------------------------------------------------------
   UPLOAD EVENT BANNER
--------------------------------------------------------- */
router.post("/banner", uploadEventBanner.single("banner"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Normalize path (important for Render / Linux / Windows)
    const fileUrl =
      req.file.secure_url || 
      req.file.url || 
      req.file.path?.replace(/\\/g, "/");

    if (!fileUrl) {
      return res.json({
        success: false,
        message: "Upload failed",
      });
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
});

export default router;
