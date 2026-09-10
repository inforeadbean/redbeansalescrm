import express from "express";
import {
  listTargets,
  getMyTarget,
  upsertTarget,
  updateTarget,
  deleteTarget,
} from "../controllers/targetController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/me", getMyTarget);
router.get("/", listTargets);
router.post("/", authorize("admin", "manager"), upsertTarget);
router.put("/:id", authorize("admin", "manager"), updateTarget);
router.delete("/:id", authorize("admin", "manager"), deleteTarget);

export default router;
