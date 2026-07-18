import { Router } from 'express';
import { body } from 'express-validator';
import {
  saveMaterial,
  getMaterialsByVideo,
  updateMaterial,
  deleteMaterial,
} from '../controllers/material.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.use(auth);

router.post(
  '/',
  role('ADMIN', 'TEACHER'),
  [
    body('videoId').isInt().withMessage('Video ID must be an integer'),
    body('name').notEmpty().withMessage('Name is required'),
    body('url').notEmpty().withMessage('URL is required'),
    body('publicId').notEmpty().withMessage('Public ID is required'),
  ],
  saveMaterial
);

router.get('/video/:videoId', getMaterialsByVideo);

router.put(
  '/:id',
  role('ADMIN', 'TEACHER'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  ],
  updateMaterial
);

router.delete('/:id', role('ADMIN', 'TEACHER'), deleteMaterial);

export default router;
