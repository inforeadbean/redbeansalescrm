import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { assertConfig } from "./config/assertConfig.js";
import { mongoSanitize } from "./middleware/sanitize.js";
import { connectDB, stopMemoryServer } from "./config/db.js";
import { seedBase } from "./seed/seedBase.js";
import { seedDemo } from "./seed/seedDemo.js";
import User from "./models/User.js";
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

dotenv.config();
assertConfig(); // stop now if JWT_SECRET is missing / default / weak

const app = express();

// Behind a reverse proxy (Render/Nginx) so rate-limit & friends read the real
// client IP from X-Forwarded-For rather than the proxy's.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",") }));
// 5mb (vs the 100kb default) so a bulk lead import — the client still chunks it,
// but a single chunk of a few hundred rows can otherwise trip the default cap.
app.use(express.json({ limit: "5mb" }));
app.use(mongoSanitize); // drop `$`/`.` keys from body, query & params
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Blanket limiter for the whole API — a generous DoS backstop, not something a
// real client ever hits (a whole office behind one NAT IP still fits). It's
// also the only throttle on /auth/login now: the per-account lockout was
// removed (2026-09-09) because it locked real people out; this IP cap still
// stops a fast automated brute-force from one source.
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

app.use(notFound);
app.use(errorHandler);

await connectDB();
// On an empty boot, create the three real starting accounts (admin + sales
// head + sales person) and nothing else — data is entered by hand from here.
// `npm run dev` keeps one MongoDB alive for the whole session, so this runs
// once, not on every nodemon restart.
// Want a populated demo instead? set SEED_DEMO=true, or run `npm run seed:demo`.
if (process.env.SEED_DEMO === "true" && (await User.estimatedDocumentCount()) <= 1) {
  console.log("[Server] SEED_DEMO=true — loading the full demo dataset…");
  const t = Date.now();
  await seedDemo({ quiet: true });
  console.log(`[Server] demo data ready in ${((Date.now() - t) / 1000).toFixed(1)}s`);
} else {
  await seedBase();
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`[Server] RBH Sales CRM API running on port ${PORT}`)
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await stopMemoryServer();
      process.exit(0);
    });
  });
}
