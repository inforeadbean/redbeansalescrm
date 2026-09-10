import express from "express";
import rateLimit from "express-rate-limit";
import { chat } from "../controllers/assistantController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Tighter than the blanket /api limiter — each call hits a paid external API.
// Keyed per user so one chatty salesperson can't starve everyone else's quota.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { message: "Too many questions in a short time — wait a few minutes and try again." },
});

router.post("/chat", chatLimiter, chat);

export default router;
