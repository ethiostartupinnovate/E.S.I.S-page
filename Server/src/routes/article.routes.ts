import express from 'express';
import * as articleController from '../controllers/article.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const router = express.Router();

// Public routes
router.get('/articles', articleController.getArticles);
router.get('/articles/:slug', articleController.getArticleBySlug);
router.get('/articles/:id/related', articleController.getRelatedArticles);

// Admin routes
router.post('/admin/articles', authenticate, authorize(['ADMIN']), articleController.createArticle);
router.patch('/admin/articles/:id', authenticate, authorize(['ADMIN']), articleController.updateArticle);
router.post('/admin/articles/:id/publish', authenticate, authorize(['ADMIN']), articleController.publishArticle);
router.delete('/admin/articles/:id', authenticate, authorize(['ADMIN']), articleController.deleteArticle);

export default router;
