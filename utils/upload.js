import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

/* --------------------------------------------------------
   CLOUDINARY CONFIG
-------------------------------------------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* --------------------------------------------------------
   FILE TYPE & SIZE LIMITS
-------------------------------------------------------- */
const allowedFormats = ["jpg", "jpeg", "png", "webp"];
const maxSize = 5 * 1024 * 1024; // 5MB

function fileFilter(req, file, cb) {
  const ext = file.mimetype.split("/")[1];

  if (!allowedFormats.includes(ext)) {
    return cb(
      new Error("Invalid file type. Only JPG, PNG, WEBP allowed."),
      false
    );
  }
  cb(null, true);
}

/* --------------------------------------------------------
   FACTORY FUNCTION — Reusable Storage Creator
-------------------------------------------------------- */
const createUploader = (folder, transformation = []) =>
  multer({
    storage: new CloudinaryStorage({
      cloudinary,
      params: {
        folder,
        allowed_formats: allowedFormats,
        transformation,
        resource_type: "image",
      },
    }),
    limits: { fileSize: maxSize },
    fileFilter,
  });

/* --------------------------------------------------------
   🔥 UPLOADERS (READY FOR ALL ROUTES)
-------------------------------------------------------- */

// Profile Pictures
export const uploadProfile = createUploader("greycat/profile", [
  { width: 500, height: 500, crop: "fill" },
]);

// Posts
export const uploadPost = createUploader("greycat/posts", [
  { width: 1080, crop: "limit" },
]);

// Projects
export const uploadProject = createUploader("greycat/projects", [
  { width: 800, crop: "limit" },
]);

// Events – Banner
export const uploadEventBanner = createUploader("greycat/events", [
  { width: 1200, height: 400, crop: "fill" },
]);
