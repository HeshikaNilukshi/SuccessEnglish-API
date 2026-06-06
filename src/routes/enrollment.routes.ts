import { Router } from 'express';
import { body } from 'express-validator';
import * as enrollmentController from '../controllers/enrollment.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';
import { upload } from '../utils/cloudinary';

const router = Router();

// /my MUST be registered before /:id paths
router.get('/my', auth, role('STUDENT'), enrollmentController.getMyEnrollments);

router.post(
  '/',
  auth,
  role('STUDENT'),
  upload.single('receipt'),
  [
    body('courseId').isInt().withMessage('courseId must be an integer'),
  ],
  enrollmentController.requestEnrollment
);

router.get('/', auth, role('ADMIN'), enrollmentController.getAllEnrollments);

router.patch(
  '/:id/verify',
  auth,
  role('ADMIN'),
  [
    body('verified').isBoolean().withMessage('verified must be a boolean value (true or false)'),
  ],
  enrollmentController.verifyEnrollment
);

export default router;
