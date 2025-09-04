import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { Request, Response } from 'express';
import fs from 'fs';
import { default as slugify } from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

// Public endpoints
export const getProjects = async (req: Request, res: Response) => {
  const { tag, team, stack, country } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    status: { in: ['APPROVED', 'FEATURED'] },
  };

  // For admin routes, allow filtering by status
  if (req.path.startsWith('/admin') && req.query.status) {
    where.status = req.query.status;
  }

  if (tag) {
    where.tags = {
      some: {
        tag: {
          slug: tag,
        },
      },
    };
  }

  if (team) {
    where.teamName = {
      contains: team,
      mode: 'insensitive',
    };
  }

  if (stack) {
    where.stack = {
      has: stack,
    };
  }

  if (country) {
    where.country = country;
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      teamName: true,
      coverImage: true,
      country: true,
      stack: true,
      status: true,
      featuredAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          profile: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
      tags: {
        select: {
          tag: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: [
      { featuredAt: 'desc' },
      { createdAt: 'desc' },
    ],
    skip,
    take: limit,
  });

  const total = await prisma.project.count({ where });

  return res.json({
    data: projects,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getProjectBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  const project = await prisma.project.findUnique({
    where: { slug: slug! },
    include: {
      user: {
        select: {
          id: true,
          profile: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
      tags: {
        select: {
          tag: true,
        },
      },
      media: true,
    },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // If project is not approved/featured and user is not owner/admin
  if (
    !['APPROVED', 'FEATURED'].includes(project.status) &&
    req.user?.id !== project.userId &&
    req.user?.role !== 'ADMIN'
  ) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  return res.json(project);
};

// Contributor endpoints
export const createProject = async (req: Request, res: Response) => {
  const { title, summary, teamName, description, stack, country } = req.body;
  const userId = req.user!.id;

  // Validate required fields
  if (!title || !summary || !teamName) {
    throw new BadRequestsException('Title, summary, and team name are required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const slug = slugify.default(title, { lower: true, strict: true });

  // Check if slug already exists
  const existingProject = await prisma.project.findUnique({
    where: { slug },
  });

  if (existingProject) {
    throw new BadRequestsException('A project with this title already exists', ErrorCode.RESOURCE_ALREADY_EXISTS);
  }

  const project = await prisma.project.create({
    data: {
      title,
      slug,
      summary,
      teamName,
      description,
      stack: stack || [],
      country,
      userId,
    },
  });

  return res.status(201).json(project);
};

export const updateProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    summary,
    teamName,
    description,
    teamMembers,
    demoLink,
    repoLink,
    stack,
    country,
  } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is owner or admin
  if (project.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  // Only allow edits for projects that are not yet submitted or in changes requested status
  if (!['PENDING', 'CHANGES_REQUESTED'].includes(project.status) && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Cannot edit project in its current status', ErrorCode.FORBIDDEN);
  }

  // Create new slug if title changed
  let slug = project.slug;
  if (title && title !== project.title) {
    slug = slugify.default(title, { lower: true, strict: true });
    
    // Check if new slug already exists
    const existingProject = await prisma.project.findFirst({
      where: {
        slug,
        id: { not: parseInt(id!) },
      },
    });

    if (existingProject) {
      throw new BadRequestsException('A project with this title already exists', ErrorCode.RESOURCE_ALREADY_EXISTS);
    }
  }

  // Update project
  const updatedProject = await prisma.project.update({
    where: { id: parseInt(id!) },
    data: {
      title: title || undefined,
      slug,
      summary: summary || undefined,
      teamName: teamName || undefined,
      description: description || undefined,
      teamMembers: teamMembers || undefined,
      demoLink: demoLink || undefined,
      repoLink: repoLink || undefined,
      stack: stack || undefined,
      country: country || undefined,
    },
  });

  return res.json(updatedProject);
};

export const getPresignedUrl = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { fileType, fileName } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is owner or admin
  if (project.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  const fileExtension = fileName.split('.').pop();
  const key = `projects/${project.id}/${uuidv4()}.${fileExtension}`;

  // Note: You'll need to implement S3 configuration
  // This is a placeholder for the actual S3 implementation
  const uploadUrl = `https://example.com/upload/${key}`; // Replace with actual S3 URL generation

  return res.json({
    uploadUrl,
    key,
    url: `https://example.com/${key}`, // Replace with actual S3 URL
  });
};

export const addProjectMedia = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { url, type } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is owner or admin
  if (project.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  // Add media
  const media = await prisma.projectMedia.create({
    data: {
      projectId: parseInt(id!),
      url,
      type: type || 'IMAGE',
    },
  });

  // If this is the first image and no cover image exists, set it as cover
  if (type === 'IMAGE' && !project.coverImage) {
    await prisma.project.update({
      where: { id: parseInt(id!) },
      data: {
        coverImage: url,
      },
    });
  }

  return res.status(201).json(media);
};

export const submitProject = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is owner or admin
  if (project.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  // Only allow submission for projects in pending or changes requested status
  if (!['PENDING', 'CHANGES_REQUESTED'].includes(project.status)) {
    throw new BadRequestsException('Project cannot be submitted in its current status', ErrorCode.FORBIDDEN);
  }

  const updatedProject = await prisma.project.update({
    where: { id: parseInt(id!) },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });

  return res.json(updatedProject);
};

export const flagProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user!.id;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  if (!reason) {
    throw new BadRequestsException('Reason for flagging is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Create flag
  const flag = await prisma.projectFlag.create({
    data: {
      projectId: parseInt(id!),
      userId,
      reason,
    },
  });

  return res.status(201).json(flag);
};

// Admin endpoints
export const getAdminProjects = async (req: Request, res: Response) => {
  const { status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          profile: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      },
      flags: {
        where: {
          resolved: false,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { submittedAt: 'asc' },
    ],
    skip,
    take: limit,
  });

  const total = await prisma.project.count({ where });

  return res.json({
    data: projects,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

export const approveProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { featured } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  const updatedProject = await prisma.project.update({
    where: { id: parseInt(id!) },
    data: {
      status: featured ? 'FEATURED' : 'APPROVED',
      featuredAt: featured ? new Date() : null,
    },
  });

  return res.json(updatedProject);
};

export const rejectProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  if (!reason) {
    throw new BadRequestsException('Reason for rejection is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  const updatedProject = await prisma.project.update({
    where: { id: parseInt(id!) },
    data: {
      status: 'REJECTED',
      modNotes: reason,
    },
  });

  return res.json(updatedProject);
};

export const requestChanges = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!id) {
    throw new BadRequestsException('Project ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  if (!message) {
    throw new BadRequestsException('Change request message is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  const project = await prisma.project.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!project) {
    throw new BadRequestsException('Project not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  const updatedProject = await prisma.project.update({
    where: { id: parseInt(id!) },
    data: {
      status: 'CHANGES_REQUESTED',
      modNotes: message,
    },
  });

  return res.json(updatedProject);
};

export const createProjectFormData = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Fields from form-data
    const { title, summary, teamName, description, stack, country, teamMembers, demoLink, repoLink } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!title || !summary || !teamName) {
      throw new BadRequestsException('Title, summary, and team name are required', ErrorCode.UNPROCESSABLE_ENTITY);
    }

    const slug = slugify.default(title, { lower: true, strict: true });
    const existingProject = await prisma.project.findUnique({ where: { slug } });
    if (existingProject) {
      throw new BadRequestsException('A project with this title already exists', ErrorCode.RESOURCE_ALREADY_EXISTS);
    }

    // Parse stack if sent as JSON string
    let stackArr = [];
    if (typeof stack === 'string') {
      try { stackArr = JSON.parse(stack); } catch { stackArr = [stack]; }
    } else if (Array.isArray(stack)) {
      stackArr = stack;
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        title,
        slug,
        summary,
        teamName,
        description,
        stack: stackArr,
        country,
        teamMembers,
        demoLink,
        repoLink,
        userId,
      },
    });

    // Move uploaded files to /uploads/projects/:projectId/
    const projectMediaDir = path.join(__dirname, '../../uploads/projects', String(project.id));
    fs.mkdirSync(projectMediaDir, { recursive: true });
    const mediaRecords = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const type = ext.match(/\.(mp4|mov|avi|webm)$/) ? 'VIDEO' : 'IMAGE';
      const destPath = path.join(projectMediaDir, file.filename);
      fs.renameSync(file.path, destPath);
      // Save media record
      const media = await prisma.projectMedia.create({
        data: {
          projectId: project.id,
          url: `/uploads/projects/${project.id}/${file.filename}`,
          type,
        },
      });
      mediaRecords.push(media);
      // Set cover image if first image and not set
      if (type === 'IMAGE' && !project.coverImage) {
        await prisma.project.update({ where: { id: project.id }, data: { coverImage: media.url } });
      }
    }

    // Return project with media
    const projectWithMedia = await prisma.project.findUnique({
      where: { id: project.id },
      include: { media: true },
    });
    return res.status(201).json(projectWithMedia);
  } catch (error) {
    console.error('Error in createProjectFormData:', error);
    throw error;
  }
};
