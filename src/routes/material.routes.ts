import { Router } from 'express';
import { body } from 'express-validator';
import * as materialController from '../controllers/material.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';
import { upload } from '../utils/cloudinary';

const router = Router();

router.post(
  '/',
  auth,
  role('ADMIN', 'TEACHER'),
  upload.single('file'),
  [
    body('courseId').notEmpty().withMessage('courseId is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('fileType').isIn(['video', 'document']).withMessage('fileType must be video or document'),
  ],
  materialController.uploadMaterial
);

router.get('/course/:courseId', auth, materialController.getMaterialsByCourse);

router.get('/:id/download', auth, materialController.downloadMaterial);

router.put(
  '/:id',
  auth,
  role('ADMIN', 'TEACHER'),
  upload.single('file'),
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  ],
  materialController.updateMaterial
);

router.delete('/:id', auth, role('ADMIN', 'TEACHER'), materialController.deleteMaterial);

export default router;
