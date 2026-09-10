import express from "express";
import {
  listReminders,
  createReminder,
  updateReminder,
  markReminderRead,
  markAllRemindersRead,
  deleteReminder,
} from "../controllers/reminderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/", listReminders);
router.post("/", createReminder);
router.post("/read-all", markAllRemindersRead);
router.patch("/:id/read", markReminderRead);
router.patch("/:id", updateReminder);
router.delete("/:id", deleteReminder);

export default router;
