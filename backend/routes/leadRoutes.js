import express from "express";
import {
  listLeads,
  pipelineMeta,
  getLead,
  createLead,
  bulkCreateLeads,
  updateLead,
  updateLeadStatus,
  undoLeadStatus,
  assignLead,
  deleteLead,
  listRemarks,
  addRemark,
} from "../controllers/leadController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/meta/pipeline", pipelineMeta);
router.get("/", listLeads);
router.post("/", createLead);
router.post("/bulk", bulkCreateLeads);
router.get("/:id", getLead);
router.put("/:id", updateLead);
router.patch("/:id/status", updateLeadStatus);
router.post("/:id/undo-status", undoLeadStatus);
router.patch("/:id/assign", authorize("admin", "manager"), assignLead);
router.delete("/:id", authorize("admin", "manager"), deleteLead);
router.get("/:id/remarks", listRemarks);
router.post("/:id/remarks", addRemark);

export default router;
