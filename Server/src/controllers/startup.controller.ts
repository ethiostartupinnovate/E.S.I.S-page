import { Request, Response, NextFunction } from "express";
import { prismaClient } from "../app";
import slugify from "slugify";

export const listStartups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tag, stage, country, industry } = req.query;
    const where: any = { status: "Approved" };
    if (tag) where.tags = { has: tag };
    if (stage) where.stage = stage;
    if (country) where.country = country;
    if (industry) where.industry = industry;

    const startups = await prismaClient.startup.findMany({ where });
    res.json(startups);
  } catch (err) {
    next(err);
  }
};

export const getStartupBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startup = await prismaClient.startup.findUnique({ where: { slug: req.params.slug } });
    res.json(startup);
  } catch (err) {
    next(err);
  }
};

export const createStartup = async (req: any, res: Response, next: NextFunction) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const startup = await prismaClient.startup.create({
      data: { ...req.body, slug, userId: req.user.uid, status: "Draft" },
    });
    res.json(startup);
  } catch (err) {
    next(err);
  }
};

export const updateStartup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startup = await prismaClient.startup.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(startup);
  } catch (err) {
    next(err);
  }
};

export const submitStartup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startup = await prismaClient.startup.update({
      where: { id: req.params.id },
      data: { status: "Submitted" },
    });
    res.json(startup);
  } catch (err) {
    next(err);
  }
};
