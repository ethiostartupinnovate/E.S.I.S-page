import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  getMyInternships,
  createInternshipDraft,
  updateInternship,
  submitInternship,
  getInternshipStatus,
} from "../controllers/internship.controller";

const router = Router();

// Applicant
router.get("/me", requireAuth, getMyInternships);
router.post("/", requireAuth, createInternshipDraft);
router.patch("/:id", requireAuth, updateInternship);
router.post("/:id/submit", requireAuth, submitInternship);
router.get("/:id/status", requireAuth, getInternshipStatus);

export default router;
