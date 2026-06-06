import { Router } from 'express';
import { body } from 'express-validator';
import * as videoController from '../controllers/video.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.get('/sign', auth, role('ADMIN', 'TEACHER'), videoController.getUploadSignature);

router.post(
  '/',
  auth,
  role('ADMIN', 'TEACHER'),
  [
    body('courseId').isInt().withMessage('courseId must be an integer'),
    body('title').notEmpty().withMessage('Title is required'),
    body('videoUrl').notEmpty().withMessage('videoUrl is required'),
    body('publicId').notEmpty().withMessage('publicId is required'),
  ],
  videoController.saveVideo
);

router.get('/course/:courseId', auth, videoController.getVideosByCourse);

router.get('/:id', auth, videoController.getVideo);

router.put(
  '/:id',
  auth,
  role('ADMIN', 'TEACHER'),
  [
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('videoUrl').optional().notEmpty().withMessage('videoUrl cannot be empty'),
    body('publicId').optional().notEmpty().withMessage('publicId cannot be empty'),
  ],
  videoController.updateVideo
);

router.delete('/:id', auth, role('ADMIN', 'TEACHER'), videoController.deleteVideo);

export default router;
