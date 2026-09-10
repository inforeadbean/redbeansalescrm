import express from "express";
import {
  listUsers,
  getAssignable,
  getUser,
  createUser,
  updateUser,
  setUserStatus,
  resetPassword,
  deleteUser,
} from "../controllers/userController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/team", getAssignable);
router.get("/", listUsers);
router.post("/", authorize("admin", "manager"), createUser);
router.get("/:id", getUser);
router.put("/:id", authorize("admin", "manager"), updateUser);
router.patch("/:id/status", authorize("admin", "manager"), setUserStatus);
router.post("/:id/reset-password", authorize("admin", "manager"), resetPassword);
router.delete("/:id", authorize("admin"), deleteUser);

export default router;
