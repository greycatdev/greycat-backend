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

// OAuth strategies
import "./auth/google.js";
import "./auth/github.js";

// Routes
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

dotenv.config();

/* ---------------------------------------------------------
   BASIC SETUP
--------------------------------------------------------- */
const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const CLIENT_URL = process.env.CLIENT_URL;   // https://thegreycat.vercel.app
const BACKEND_URL = process.env.BACKEND_URL; // https://greycat-backend.onrender.com

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⭐ Required so secure cookies work behind Render's proxy
app.set("trust proxy", 1);

/* ---------------------------------------------------------
   SESSION CONFIG  (cross-domain cookie: Vercel ↔ Render)
--------------------------------------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "greycat_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7, // 7 days
    }),
    cookie: {
      httpOnly: true,
      secure: true,      // Render = HTTPS → must be true
      sameSite: "none",  // needed for cross-site cookie with Vercel
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/* ---------------------------------------------------------
   PASSPORT
--------------------------------------------------------- */
app.use(passport.initialize());
app.use(passport.session());

/* ---------------------------------------------------------
   STATIC FILES  (public assets + uploads)
--------------------------------------------------------- */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ---------------------------------------------------------
   CORS
--------------------------------------------------------- */
const allowedOrigins = [
  CLIENT_URL,
  BACKEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/https:\/\/.*\.vercel\.app$/.test(origin)) return cb(null, true);

      console.log("🚫 BLOCKED BY CORS:", origin);
      return cb(new Error("CORS Not Allowed"));
    },
    credentials: true,
  })
);

// Preflight
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.sendStatus(200);
});

/* ---------------------------------------------------------
   SECURITY + PERFORMANCE
--------------------------------------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
app.use(express.json({ limit: "20mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
  })
);

/* ---------------------------------------------------------
   BASE ROUTE
--------------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("GreyCat API Online ✔");
});

/* ---------------------------------------------------------
   ROUTES
--------------------------------------------------------- */
app.use("/auth", authRoutes);
app.use("/upload", uploadRoutes);
app.use("/user", userRoutes);
app.use("/post", postRoutes);
app.use("/follow", followRoutes);
app.use("/event", eventRoutes);
app.use("/search", searchRoutes);
app.use("/project", projectRoutes);
app.use("/settings", settingsRoutes);
app.use("/channel", channelRoutes);
app.use("/github", githubRoutes);

/* ---------------------------------------------------------
   SOCKET.IO
--------------------------------------------------------- */
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});

/* ---------------------------------------------------------
   ERROR HANDLER
--------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error("❌ SERVER ERROR:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/* ---------------------------------------------------------
   START SERVER
--------------------------------------------------------- */
connectDB();

httpServer.listen(PORT, () =>
  console.log(`🚀 GreyCat backend running at ${BACKEND_URL} on port ${PORT}`)
);
