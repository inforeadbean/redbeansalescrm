import express from "express";
import { listConversionTypes, createConversionType } from "../controllers/conversionTypeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

// No role restriction — admin, manager and salesperson can all view and add.
router.get("/", listConversionTypes);
router.post("/", createConversionType);

export default router;
