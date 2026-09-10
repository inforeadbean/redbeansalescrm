import express from "express";
import {
  getSummary,
  getFunnel,
  getTrends,
  getMyTasks,
  getTeamPipeline,
  getInsights,
} from "../controllers/dashboardController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/summary", getSummary);
router.get("/funnel", getFunnel);
router.get("/trends", getTrends);
router.get("/my-tasks", getMyTasks);
router.get("/team-pipeline", authorize("admin", "manager"), getTeamPipeline);
router.get("/insights", authorize("admin", "manager"), getInsights);

export default router;
