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
    body('price').isDecimal({ decimal_digits: '0,2' }).withMessage('Price must be a valid decimal number'),
  ],
  courseController.createCourse
);

router.get('/', courseController.getAllCourses);
router.get('/:id', auth, courseController.getCourse);

router.put(
  '/:id',
  auth,
  role('ADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Course name cannot be empty'),
    body('price').optional().isDecimal({ decimal_digits: '0,2' }).withMessage('Price must be a valid decimal number'),
  ],
  courseController.updateCourse
);

router.delete('/:id', auth, role('ADMIN'), courseController.deleteCourse);

export default router;
