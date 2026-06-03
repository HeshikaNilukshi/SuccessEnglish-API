import { Router } from 'express';
import { body } from 'express-validator';
import * as courseController from '../controllers/course.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.post(
  '/',
  auth,
  role('ADMIN'),
  [
    body('name').notEmpty().withMessage('Course name is required'),
  ],
  courseController.createCourse
);

router.get('/', courseController.getAllCourses);
router.get('/:id', courseController.getCourse);

router.put(
  '/:id',
  auth,
  role('ADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Course name cannot be empty'),
  ],
  courseController.updateCourse
);

router.delete('/:id', auth, role('ADMIN'), courseController.deleteCourse);

export default router;
