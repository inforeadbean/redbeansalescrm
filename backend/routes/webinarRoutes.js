import express from "express";
import {
  listWebinars,
  getWebinar,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  addRegistrations,
  setAttendance,
  removeRegistration,
} from "../controllers/webinarController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/", listWebinars);
router.post("/", authorize("admin", "manager"), createWebinar);
router.get("/:id", getWebinar);
router.put("/:id", authorize("admin", "manager"), updateWebinar);
router.delete("/:id", authorize("admin", "manager"), deleteWebinar);
router.post("/:id/registrations", addRegistrations);
router.patch("/:id/registrations/:regId", setAttendance);
router.delete("/:id/registrations/:regId", removeRegistration);

export default router;
