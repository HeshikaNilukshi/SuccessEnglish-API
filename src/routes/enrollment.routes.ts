import { Router } from 'express';
import { body } from 'express-validator';
import * as enrollmentController from '../controllers/enrollment.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

// /my MUST be registered before /:id paths
router.get('/my', auth, role('STUDENT'), enrollmentController.getMyEnrollments);

router.post(
  '/',
  auth,
  role('STUDENT'),
  [
    body('courseId').notEmpty().withMessage('courseId is required'),
  ],
  enrollmentController.requestEnrollment
);

router.get('/', auth, role('ADMIN'), enrollmentController.getAllEnrollments);

router.patch('/:id/verify', auth, role('ADMIN'), enrollmentController.verifyEnrollment);

export default router;
