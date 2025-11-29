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

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;
const MONGO_URI = process.env.MONGO_URI;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", 1);

/* ---------------------------------------------------------
   SESSION (Render & Express v5 compatible)
--------------------------------------------------------- */
const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "greycat_secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction, // Render = true
      sameSite: isProduction ? "none" : "lax",
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
   ALLOWED ORIGINS
--------------------------------------------------------- */
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
];

/* ---------------------------------------------------------
   CORS (Render + Express v5 Compatible)
--------------------------------------------------------- */
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      if (/https:\/\/.*\.vercel\.app$/.test(origin)) return cb(null, true);

      console.log("❌ CORS BLOCKED:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ---------------------------------------------------------
   FIX: Express v5 breaks on app.options("*") — this replaces it
--------------------------------------------------------- */
app.options("/*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  return res.sendStatus(200);
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
app.use(express.json({ limit: "10mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
  })
);

/* ---------------------------------------------------------
   STATIC FILES
--------------------------------------------------------- */
app.use(express.static(path.join(__dirname, "public"))); // default-profile.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
  console.error("Server Error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/* ---------------------------------------------------------
   START SERVER
--------------------------------------------------------- */
connectDB();

httpServer.listen(PORT, () =>
  console.log(`🚀 GreyCat server running on port ${PORT}`)
);
