import express from "express";
import {
  login,
  getMe,
  logout,
  updateMe,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.put("/me", protect, updateMe);
router.post("/change-password", protect, changePassword);

export default router;
