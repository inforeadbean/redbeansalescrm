import express from "express";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  addInvitees,
  setInvitee,
  removeInvitee,
} from "../controllers/eventController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/", listEvents);
router.post("/", authorize("admin", "manager"), createEvent);
router.get("/:id", getEvent);
router.put("/:id", authorize("admin", "manager"), updateEvent);
router.delete("/:id", authorize("admin", "manager"), deleteEvent);
router.post("/:id/invitees", addInvitees);
router.patch("/:id/invitees/:inviteeId", setInvitee);
router.delete("/:id/invitees/:inviteeId", removeInvitee);

export default router;
