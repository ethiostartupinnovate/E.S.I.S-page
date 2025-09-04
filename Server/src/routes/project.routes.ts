import express from 'express';

import path from 'path';
import { fileURLToPath } from 'url';
import * as projectController from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { upload } from '../middlewares/multer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router(); // Router for project endpoints

// Public routes
router.get('/projects', projectController.getProjects);
router.get('/projects/:slug', projectController.getProjectBySlug);

// Contributor routes (requires authentication)
router.post('/projects', authenticate, projectController.createProject);
// New: Form-data project submission (fields + media)
router.post('/projects/form', authenticate, upload.array('media', 10), projectController.createProjectFormData);
router.patch('/projects/:id', authenticate, projectController.updateProject);
router.post('/projects/:id/media', authenticate, projectController.addProjectMedia);
router.post('/projects/:id/upload-url', authenticate, projectController.getPresignedUrl);
router.post('/projects/:id/submit', authenticate, projectController.submitProject);
router.post('/projects/:id/flag', authenticate, projectController.flagProject);

// Admin routes
router.get('/admin/projects', authenticate, authorize(['ADMIN']), projectController.getAdminProjects);
router.post('/admin/projects/:id/approve', authenticate, authorize(['ADMIN']), projectController.approveProject);
router.post('/admin/projects/:id/reject', authenticate, authorize(['ADMIN']), projectController.rejectProject);
router.post('/admin/projects/:id/request-changes', authenticate, authorize(['ADMIN']), projectController.requestChanges);

export default router;
