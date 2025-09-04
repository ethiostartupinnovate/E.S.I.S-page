import type { Request, Response } from 'express';
import { default as slugify } from 'slugify';
import { BadRequestsException } from '../exceptions/bad-requests.js';
import { ErrorCode } from '../exceptions/root.js';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

// Public endpoints
export const getArticles = async (req: Request, res: Response) => {
  const { tag, category, status } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    status: 'PUBLISHED',
    publishedAt: {
      lte: new Date(),
    },
  };

  // For admin routes, allow filtering by status
  if (req.path.startsWith('/admin') && status) {
    where.status = status;
    delete where.publishedAt;
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

  if (category) {
    where.category = {
      slug: category,
    };
  }

  const articles = await prisma.article.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      featuredImage: true,
      publishedAt: true,
      createdAt: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      author: {
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
    orderBy: {
      publishedAt: 'desc',
    },
    skip,
    take: limit,
  });

  const total = await prisma.article.count({ where });

  return res.json({
    data: articles,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

export const getArticleBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;

  console.log('Fetching article with slug:', slug);

  if (!slug) {
    console.log('No slug provided');
    throw new BadRequestsException('Slug is required', ErrorCode.UNPROCESSABLE_ENTITY);
  }

  try {
    const article = await prisma.article.findUnique({
      where: { slug },
      include: {
        category: true,
        author: {
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
      },
    });

    console.log('Article found:', article ? `ID: ${article.id}, Title: ${article.title}` : 'None');

    if (!article) {
      throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // If article is not published and user is not admin/author
    if (
      article.status !== 'PUBLISHED' &&
      req.user?.id !== article.authorId &&
      req.user?.role !== 'ADMIN'
    ) {
      console.log('Article not visible to current user. Status:', article.status, 'User:', req.user?.id, 'Role:', req.user?.role);
      throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return res.json(article);
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    if (error instanceof BadRequestsException) {
      throw error;
    }
    throw new BadRequestsException('Error fetching article', ErrorCode.INTERNAL_EXCEPTION);
  }
};

export const getRelatedArticles = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  console.log('Fetching related articles for article ID:', id);
  
  try {
    if (!id || isNaN(parseInt(id))) {
      console.log('Invalid article ID:', id);
      throw new BadRequestsException('Valid article ID is required', ErrorCode.UNPROCESSABLE_ENTITY);
    }
    
    const article = await prisma.article.findUnique({
      where: { id: parseInt(id) },
      include: {
        tags: {
          select: {
            tagId: true,
          },
        },
      },
    });

    console.log('Source article found:', article ? `Title: ${article.title}` : 'None');
    
    if (!article) {
      throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const tagIds = article.tags.map(tag => tag.tagId);
    console.log('Tags found:', tagIds.length, 'Tag IDs:', tagIds);
    
    // If no tags, try to find articles in the same category
    if (tagIds.length === 0) {
      console.log('No tags found, trying to find articles in the same category');
      
      const relatedByCategory = await prisma.article.findMany({
        where: {
          id: { not: parseInt(id) },
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
          categoryId: article.categoryId,
        },
        include: {
          category: true,
          author: {
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
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      });
      
      console.log('Related by category:', relatedByCategory.length);
      return res.json(relatedByCategory);
    }

    const relatedArticles = await prisma.article.findMany({
      where: {
        id: { not: parseInt(id) },
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
        tags: {
          some: {
            tagId: { in: tagIds },
          },
        },
      },
      include: {
        category: true,
        author: {
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
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    });

    console.log('Related articles found:', relatedArticles.length);
    return res.json(relatedArticles);
  } catch (error) {
    console.error('Error fetching related articles:', error);
    if (error instanceof BadRequestsException) {
      throw error;
    }
    throw new BadRequestsException('Error fetching related articles', ErrorCode.INTERNAL_EXCEPTION);
  }
};

// Admin endpoints
export const createArticle = async (req: Request, res: Response) => {
  const { title, content, summary, categoryId, categoryName, tags } = req.body;
  const authorId = req.user!.id;

  const slug = slugify.default(title, { lower: true, strict: true });

  // Check if slug already exists
  const existingArticle = await prisma.article.findUnique({
    where: { slug },
  });

  if (existingArticle) {
    throw new BadRequestsException('An article with this title already exists', ErrorCode.RESOURCE_ALREADY_EXISTS);
  }

  // Create article data object
  const articleData: any = {
    title,
    slug,
    content,
    summary,
    authorId,
    status: 'DRAFT',
  };
  
  // Handle category connection
  if (categoryId) {
    // Try to use existing category by ID
    const categoryExists = await prisma.category.findUnique({
      where: { id: parseInt(categoryId.toString()) },
    });
    
    if (categoryExists) {
      articleData.categoryId = parseInt(categoryId.toString());
    } else {
      // Create a new category if specified ID doesn't exist
      const newCategory = await prisma.category.create({
        data: {
          name: categoryName || `Category ${categoryId}`,
          slug: slugify.default(categoryName || `Category ${categoryId}`, { lower: true, strict: true }),
        }
      });
      articleData.categoryId = newCategory.id;
    }
  } else if (categoryName) {
    // Create or connect to a category by name
    const categorySlug = slugify.default(categoryName, { lower: true, strict: true });
    
    // Check if category with this name already exists
    const existingCategory = await prisma.category.findFirst({
      where: { 
        OR: [
          { name: categoryName },
          { slug: categorySlug }
        ]
      }
    });
    
    if (existingCategory) {
      articleData.categoryId = existingCategory.id;
    } else {
      // Create a new category
      const newCategory = await prisma.category.create({
        data: {
          name: categoryName,
          slug: categorySlug,
        }
      });
      articleData.categoryId = newCategory.id;
    }
  }

  const article = await prisma.article.create({
    data: {
      ...articleData,
      ...(tags && {
        tags: {
          create: tags.map((tagName: string) => ({
            tag: { 
              connectOrCreate: { 
                where: { slug: slugify.default(tagName, { lower: true, strict: true }) },
                create: { 
                  name: tagName,
                  slug: slugify.default(tagName, { lower: true, strict: true })
                }
              } 
            },
          })),
        }
      }),
    },
  });

  return res.status(201).json(article);
};

export const updateArticle = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    content,
    summary,
    categoryId,
    tags,
    metaTitle,
    metaDescription,
    featuredImage,
    status,
    publishAt,
  } = req.body;

  const article = await prisma.article.findUnique({
    where: { id: parseInt(id!) },
    include: { tags: true },
  });

  if (!article) {
    throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is author or admin
  if (article.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  // Create new slug if title changed
  let slug = article.slug;
  if (title && title !== article.title) {
    slug = slugify.default(title, { lower: true, strict: true });
    
    // Check if new slug already exists
    const existingArticle = await prisma.article.findFirst({
      where: {
        slug,
        id: { not: parseInt(id!) },
      },
    });

    if (existingArticle) {
      throw new BadRequestsException('An article with this title already exists', ErrorCode.RESOURCE_ALREADY_EXISTS);
    }
  }

  // If scheduling for future
  let publishedAt = article.publishedAt;
  if (publishAt && status === 'SCHEDULED') {
    publishedAt = new Date(publishAt);
  }

  // Update article
  const updateData = {
    title: title || undefined,
    slug,
    content: content || undefined,
    summary: summary || undefined,
    categoryId: categoryId ? parseInt(categoryId) : null,
    metaTitle: metaTitle || undefined,
    metaDescription: metaDescription || undefined,
    featuredImage: featuredImage || undefined,
    status: status || undefined,
    publishedAt: status === 'PUBLISHED' ? new Date() : publishedAt,
  };

  // Add tags separately to avoid type issues
  if (tags) {
    const updatedArticle = await prisma.article.update({
      where: { id: parseInt(id!) },
      data: {
        ...updateData,
        tags: {
          deleteMany: {},
          create: tags.map((tagId: number) => ({
            tag: { connect: { id: tagId } },
          })),
        },
      },
    });
    return res.json(updatedArticle);
  } else {
    const updatedArticle = await prisma.article.update({
      where: { id: parseInt(id!) },
      data: updateData,
    });
    return res.json(updatedArticle);
  }
};

export const publishArticle = async (req: Request, res: Response) => {
  const { id } = req.params;

  const article = await prisma.article.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!article) {
    throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is author or admin
  if (article.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  const updatedArticle = await prisma.article.update({
    where: { id: parseInt(id!) },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  return res.json(updatedArticle);
};

export const deleteArticle = async (req: Request, res: Response) => {
  const { id } = req.params;

  const article = await prisma.article.findUnique({
    where: { id: parseInt(id!) },
  });

  if (!article) {
    throw new BadRequestsException('Article not found', ErrorCode.RESOURCE_NOT_FOUND);
  }

  // Check if user is author or admin
  if (article.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
    throw new BadRequestsException('Unauthorized', ErrorCode.UNAUTHORIZED);
  }

  await prisma.article.delete({
    where: { id: parseInt(id!) },
  });

  return res.json({ message: 'Article deleted successfully' });
};
