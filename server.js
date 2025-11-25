import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import path from "path";
import { Server as IOServer } from "socket.io";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";

/* OAuth Config */
import "./auth/google.js";
import "./auth/github.js";

/* Routes */
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import githubRoutes from "./routes/github.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import channelRoutes from "./routes/channelRoutes.js";
import uploadRoutes from "./routes/upload.js";

/* Resolve dirname */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* Load environment variables */
dotenv.config();

const app = express();

/* ----------------------------------------------------------
   GLOBAL CONFIG
---------------------------------------------------------- */
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;
const isProd = process.env.NODE_ENV === "production";

/* Trust proxy for Render/Vercel/Nginx */
app.set("trust proxy", 1);

/* ----------------------------------------------------------
   SECURITY + PERFORMANCE
---------------------------------------------------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));

/* Rate Limiter */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many requests. Please try again later.",
  })
);

/* ----------------------------------------------------------
   CORS FIX (Handles mobile preflight + direct origins)
---------------------------------------------------------- */
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ CORS blocked:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

/* Explicit preflight handling (fixes mobile login loop) */
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));

/* ----------------------------------------------------------
   STATIC UPLOADS
---------------------------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ----------------------------------------------------------
   SESSION CONFIG
---------------------------------------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "greycat_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* Initialize Passport */
app.use(passport.initialize());
app.use(passport.session());

/* ----------------------------------------------------------
   TEST ROUTE
---------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("GreyCat API Online ✔");
});

/* ----------------------------------------------------------
   API ROUTES
---------------------------------------------------------- */
app.use("/upload", uploadRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/post", postRoutes);
app.use("/follow", followRoutes);
app.use("/event", eventRoutes);
app.use("/search", searchRoutes);
app.use("/project", projectRoutes);
app.use("/settings", settingsRoutes);
app.use("/channel", channelRoutes);
app.use("/github", githubRoutes);

/* ----------------------------------------------------------
   SOCKET.IO SERVER
---------------------------------------------------------- */
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🔥 Socket connected:", socket.id);

  socket.on("joinRoom", (channelId) => socket.join(channelId));
  socket.on("leaveRoom", (channelId) => socket.leave(channelId));

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ----------------------------------------------------------
   ERROR HANDLER
---------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/* ----------------------------------------------------------
   START SERVER
---------------------------------------------------------- */
connectDB();

httpServer.listen(PORT, () =>
  console.log(`🚀 GreyCat server running on port: ${PORT}`)
);
