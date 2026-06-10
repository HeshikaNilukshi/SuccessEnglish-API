import { Router } from 'express';
import { body } from 'express-validator';
import * as userController from '../controllers/user.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.get('/me', auth, userController.getMe);

router.put(
  '/me',
  auth,
  [
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  ],
  userController.updateMe
);

router.post(
  '/',
  auth,
  role('ADMIN'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['ADMIN', 'TEACHER', 'STUDENT']).withMessage('Role must be ADMIN, TEACHER, or STUDENT'),
  ],
  userController.createUser
);

router.get('/', auth, role('ADMIN'), userController.getAllUsers);

router.get('/:id', auth, role('ADMIN', 'TEACHER'), userController.getUserById);

router.put(
  '/:id',
  auth,
  role('ADMIN'),
  [
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').optional().isIn(['ADMIN', 'TEACHER', 'STUDENT']).withMessage('Role must be ADMIN, TEACHER, or STUDENT'),
  ],
  userController.updateUser
);

router.delete('/:id', auth, role('ADMIN'), userController.deleteUser);

export default router;
