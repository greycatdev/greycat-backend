import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import path from "path";
import { Server as IOServer } from "socket.io";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";

/* OAuth Providers */
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

/* dirname */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/* -------------------------------------------------------------
   EXPRESS APP
------------------------------------------------------------- */
const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;
const MONGO_URI = process.env.MONGO_URI;

/* Trust proxy required for Render / Vercel */
app.set("trust proxy", 1);

/* -------------------------------------------------------------
   SESSION (OAuth Critical)
------------------------------------------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "greycat_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* Passport */
app.use(passport.initialize());
app.use(passport.session());

/* -------------------------------------------------------------
   CORS (Supports Vercel Preview URLs)
------------------------------------------------------------- */
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];
const vercelPattern = /^https:\/\/.*vercel\.app$/;

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

/* -------------------------------------------------------------
   SECURITY + PERFORMANCE
------------------------------------------------------------- */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));

/* Rate limiter */
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: "Too many requests. Try later.",
  })
);

/* -------------------------------------------------------------
   STATIC UPLOADS
------------------------------------------------------------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* -------------------------------------------------------------
   TEST ROUTE
------------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("GreyCat API Online ✔");
});

/* -------------------------------------------------------------
   API ROUTES
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   SOCKET.IO SERVER
------------------------------------------------------------- */
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
});

/* Save io globally */
app.set("io", io);

/* -------------------------------------------------------------
   SOCKET HANDLERS
------------------------------------------------------------- */
io.on("connection", (socket) => {
  console.log("🔥 Socket connected:", socket.id);

  // Join channel room
  socket.on("joinRoom", (channelId) => {
    socket.join(channelId);
    console.log(`✅ User ${socket.id} joined room: ${channelId}`);
  });

  // Leave channel room
  socket.on("leaveRoom", (channelId) => {
    socket.leave(channelId);
    console.log(`⚠️ User ${socket.id} left room: ${channelId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* -------------------------------------------------------------
   ERROR HANDLER
------------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Server error",
  });
});

/* -------------------------------------------------------------
   START SERVER
------------------------------------------------------------- */
connectDB();

httpServer.listen(PORT, () =>
  console.log(`🚀 GreyCat server running on port ${PORT}`)
);
