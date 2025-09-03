import { Router } from "express";
import { prisma } from "../server";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth";
import { Parser } from "json2csv";

const router = Router();

// Applicant
router.get("/internship-applications/me", requireAuth, async (req: AuthRequest, res) => {
  const apps = await prisma.internshipApplication.findMany({ where: { userId: req.user!.uid } });
  res.json(apps);
});

router.post("/internship-applications", requireAuth, async (req: AuthRequest, res) => {
  const app = await prisma.internshipApplication.create({
    data: { userId: req.user!.uid, status: "Draft" }
  });
  res.json(app);
});

router.patch("/internship-applications/:id", requireAuth, async (req: AuthRequest, res) => {
  const app = await prisma.internshipApplication.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(app);
});

router.post("/internship-applications/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  const app = await prisma.internshipApplication.update({
    where: { id: req.params.id },
    data: { status: "Submitted" }
  });
  res.json(app);
});

router.get("/internship-applications/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const app = await prisma.internshipApplication.findUnique({ where: { id: req.params.id } });
  res.json({ status: app?.status });
});

// Reviewer/Admin
router.get("/admin/internship-applications", requireAuth, requireRole(["Reviewer", "Admin"]), async (req, res) => {
  const { status, score_min } = req.query;
  const where: any = {};
  if (status) where.status = status;
  if (score_min) where.score = { gte: Number(score_min) };
  const apps = await prisma.internshipApplication.findMany({ where });
  res.json(apps);
});

router.post("/admin/internship-applications/:id/score", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const app = await prisma.internshipApplication.update({
    where: { id: req.params.id },
    data: { score: req.body.score }
  });
  res.json(app);
});

router.post("/admin/internship-applications/:id/advance", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const app = await prisma.internshipApplication.update({
    where: { id: req.params.id },
    data: { status: req.body.to }
  });
  res.json(app);
});

router.post("/admin/internship-applications/bulk", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const { ids, action } = req.body;
  const result = await prisma.internshipApplication.updateMany({ where: { id: { in: ids } }, data: { status: action } });
  res.json(result);
});

router.get("/admin/internship-applications/export", requireAuth, requireRole(["Reviewer","Admin"]), async (req, res) => {
  const apps = await prisma.internshipApplication.findMany();
  const parser = new Parser();
  const csv = parser.parse(apps);
  res.header("Content-Type", "text/csv");
  res.attachment("internship_apps.csv");
  res.send(csv);
});

export default router;
