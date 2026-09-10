import express from "express";
import {
  listCalls,
  todayCalls,
  createCall,
  completeCall,
  deleteCall,
} from "../controllers/callController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/today", todayCalls);
router.get("/", listCalls);
router.post("/", createCall);
router.patch("/:id/complete", completeCall);
router.delete("/:id", deleteCall);

export default router;
