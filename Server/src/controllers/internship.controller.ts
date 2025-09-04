import { Request, Response, NextFunction } from "express";
import { prismaClient } from "../app";

export const getMyInternships = async (req: any, res: Response, next: NextFunction) => {
  try {
    const apps = await prismaClient.internshipApplication.findMany({
      where: { userId: req.user.uid },
    });
    res.json(apps);
  } catch (err) {
    next(err);
  }
};

export const createInternshipDraft = async (req: any, res: Response, next: NextFunction) => {
  try {
    const app = await prismaClient.internshipApplication.create({
      data: { userId: req.user.uid, status: "Draft" },
    });
    res.json(app);
  } catch (err) {
    next(err);
  }
};

export const updateInternship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await prismaClient.internshipApplication.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(app);
  } catch (err) {
    next(err);
  }
};

export const submitInternship = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await prismaClient.internshipApplication.update({
      where: { id: req.params.id },
      data: { status: "Submitted" },
    });
    res.json(app);
  } catch (err) {
    next(err);
  }
};

export const getInternshipStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await prismaClient.internshipApplication.findUnique({
      where: { id: req.params.id },
    });
    res.json({ status: app?.status });
  } catch (err) {
    next(err);
  }
};
