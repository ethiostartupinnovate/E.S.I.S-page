import { Router } from "express";
import { prisma } from "../server";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import slugify from "slugify";

const router = Router();

// Public directory
router.get("/startups/directory", async (req, res) => {
  const { tag, stage, country, industry } = req.query;
  const where: any = { status: "Approved" };
  if (tag) where.tags = { has: tag };
  if (stage) where.stage = stage;
  if (country) where.country = country;
  if (industry) where.industry = industry;
  const startups = await prisma.startup.findMany({ where });
  res.json(startups);
});

router.get("/startups/:slug", async (req, res) => {
  const startup = await prisma.startup.findUnique({ where: { slug: req.params.slug } });
  res.json(startup);
});

// Applicant
router.post("/startups", requireAuth, async (req: AuthRequest, res) => {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const startup = await prisma.startup.create({
    data: { ...req.body, slug, userId: req.user!.uid, status: "Draft" }
  });
  res.json(startup);
});

router.patch("/startups/:id", requireAuth, async (req, res) => {
  const startup = await prisma.startup.update({ where: { id: req.params.id }, data: req.body });
  res.json(startup);
});

router.post("/startups/:id/submit", requireAuth, async (req, res) => {
  const startup = await prisma.startup.update({ where: { id: req.params.id }, data: { status: "Submitted" } });
  res.json(startup);
});

// Reviewer/Admin
router.get("/admin/startups", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const { status } = req.query;
  const where: any = {};
  if (status) where.status = status;
  const startups = await prisma.startup.findMany({ where });
  res.json(startups);
});

router.post("/admin/startups/:id/decision", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const startup = await prisma.startup.update({ where: { id: req.params.id }, data: { status: req.body.to } });
  res.json({ startup, message: req.body.message });
});

router.patch("/admin/startups/:id/feature", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const startup = await prisma.startup.update({ where: { id: req.params.id }, data: { featured: req.body.featured } });
  res.json(startup);
});

export default router;
