import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { mongoSanitize } from "./middleware/sanitize.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import webinarRoutes from "./routes/webinarRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import ifoRoutes from "./routes/ifoRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import targetRoutes from "./routes/targetRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

// The Express app: the /api REST layer, and — in production — the built React
// frontend served from the same origin. `server.js` connects the DB, seeds and
// calls `listen()`. `assertConfig()` is called there, not here.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Behind a reverse proxy (Render / Nginx / a tunnel) so rate-limit & co. read
// the real client IP from X-Forwarded-For, not the proxy's.
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false })); // CSP off — the SPA needs inline styles / eval-free bundles; API is JSON only
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",") }));
// 5mb (vs the 100kb default) so one chunk of a bulk lead import fits.
app.use(express.json({ limit: "5mb" }));
app.use(mongoSanitize); // drop `$`/`.` keys from body, query & params
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Blanket limiter — a generous DoS backstop, not something a real client hits
// (a whole office behind one NAT IP still fits). Also the only throttle on
// /auth/login.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "RBH Sales CRM API" }));

app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/webinars", webinarRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/ifo", ifoRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/targets", targetRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

// --- Serve the built frontend (single-service deploy) --------------------------
// `npm run build` puts it in frontend/dist. In local dev you run Vite separately
// for HMR, so this block is skipped unless the build exists AND we're in prod
// (or SERVE_CLIENT=true). A missing build just means "API only".
const clientDist = path.resolve(__dirname, "../frontend/dist");
const wantClient = process.env.NODE_ENV === "production" || process.env.SERVE_CLIENT === "true";

if (wantClient && fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  // Anything that isn't an /api route and isn't a real file → the SPA shell,
  // so client-side routes (/leads/123, /reports/calling, …) resolve on reload.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else if (wantClient) {
  console.warn(`[app] SERVE_CLIENT is on but ${clientDist}/index.html is missing — run \`npm run build\`. Serving API only.`);
}

app.use(notFound); // /api/* misses (and any path if the client build isn't served)
app.use(errorHandler);

export default app;
