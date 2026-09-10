import express from "express";
import {
  listIfo,
  getIfo,
  createIfo,
  addPayment,
  updateIfo,
  deleteIfo,
} from "../controllers/ifoController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/", listIfo);
router.post("/", createIfo);
router.get("/:id", getIfo);
router.post("/:id/payments", addPayment);
router.put("/:id", updateIfo);
router.delete("/:id", authorize("admin", "manager"), deleteIfo);

export default router;
