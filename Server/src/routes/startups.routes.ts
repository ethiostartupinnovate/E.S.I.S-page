import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  listStartups,
  getStartupBySlug,
  createStartup,
  updateStartup,
  submitStartup,
} from "../controllers/startup.controller";

const router = Router();

// Public
router.get("/directory", listStartups);
router.get("/:slug", getStartupBySlug);

// Applicant
router.post("/", requireAuth, createStartup);
router.patch("/:id", requireAuth, updateStartup);
router.post("/:id/submit", requireAuth, submitStartup);

export default router;

