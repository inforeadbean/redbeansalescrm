import express from "express";
import {
  getFiveForThree,
  getCallingReport,
  getLeaderboard,
  getFunnel,
  getReceivables,
  getPaymentDelays,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

// Management reports; the leaderboard is for everyone.
router.get("/five-for-three", authorize("admin", "manager"), getFiveForThree);
router.get("/calling", authorize("admin", "manager"), getCallingReport);
router.get("/funnel", authorize("admin", "manager"), getFunnel);
router.get("/receivables", authorize("admin", "manager"), getReceivables);
router.get("/payment-delays", authorize("admin", "manager"), getPaymentDelays);
router.get("/leaderboard", getLeaderboard);

export default router;
