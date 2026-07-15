import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import routes from "./routes/index.js";
import errorHandler, { notFoundHandler } from "./middlewares/errorHandler.js";
import { UPLOADS_DIR } from "./middlewares/uploadMiddleware.js";

const app = express();
const PORT = process.env.PORT || 5001;

const normalizeOrigin = (value) => {
  const cleaned = String(value || "").trim().replace(/\/+$/, "");
  return cleaned || null;
};

const addOriginVariants = (set, value) => {
  const origin = normalizeOrigin(value);
  if (!origin) return;

  set.add(origin);

  try {
    const parsed = new URL(origin);
    const { protocol, hostname } = parsed;

    // Allow both apex and www for the main client site
    if (hostname.startsWith("www.")) {
      set.add(`${protocol}//${hostname.slice(4)}`);
    } else if ((hostname.match(/\./g) || []).length === 1) {
      set.add(`${protocol}//www.${hostname}`);
    }
  } catch {
    // Ignore invalid origin values from env
  }
};

const allowedOrigins = new Set();

[
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  process.env.PARTNER_URL,
  ...(process.env.ALLOWED_ORIGINS || "").split(","),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
].forEach((origin) => addOriginVariants(allowedOrigins, origin));

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients (Postman, server-to-server) send no Origin
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      console.warn(`CORS blocked for origin: ${origin}`);
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Hittofit API is running",
    health: "/api/health",
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Hittofit API is running" });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS whitelist: ${[...allowedOrigins].join(", ")}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Change PORT in .env (macOS AirPlay uses 5000).`
      );
    } else {
      console.error("Server failed to start:", error.message);
    }
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
