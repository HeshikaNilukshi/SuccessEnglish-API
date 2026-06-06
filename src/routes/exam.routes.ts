import { Router } from 'express';
import { body } from 'express-validator';
import * as examController from '../controllers/exam.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.post(
  '/',
  auth,
  role('ADMIN', 'TEACHER'),
  [
    body('title').notEmpty().withMessage('Exam title is required'),
    body('courseId').isInt().withMessage('courseId must be an integer'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be 0 or a positive integer (minutes)'),
    body('questions').isArray({ min: 1 }).withMessage('Questions must be an array with at least one question'),
    body('questions.*.questionText').notEmpty().withMessage('Question text is required'),
    body('questions.*.correctAnswer').notEmpty().withMessage('Correct answer is required'),
    body('questions.*.marks').isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  ],
  examController.createExam
);

router.get('/course/:courseId', auth, examController.getExamsByCourse);

router.get('/:id', auth, examController.getExam);

router.put(
  '/:id',
  auth,
  role('ADMIN', 'TEACHER'),
  [
    body('title').optional().notEmpty().withMessage('Exam title cannot be empty'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be 0 or a positive integer (minutes)'),
    body('questions').optional().isArray().withMessage('Questions must be an array'),
    body('questions.*.questionText').optional().notEmpty().withMessage('Question text is required'),
    body('questions.*.correctAnswer').optional().notEmpty().withMessage('Correct answer is required'),
    body('questions.*.marks').optional().isInt({ min: 1 }).withMessage('Marks must be a positive integer'),
  ],
  examController.updateExam
);

router.delete('/:id', auth, role('ADMIN', 'TEACHER'), examController.deleteExam);

router.post('/:id/start', auth, role('STUDENT'), examController.startExam);

router.post(
  '/:id/submit',
  auth,
  role('STUDENT'),
  [
    body('answers').isArray().withMessage('Answers must be an array'),
    body('answers.*.questionId').isInt().withMessage('questionId must be an integer'),
    body('answers.*.studentAnswer').notEmpty().withMessage('studentAnswer is required'),
  ],
  examController.submitExam
);

router.get('/:id/results', auth, role('ADMIN', 'TEACHER'), examController.getExamResults);

router.get('/:id/my-result', auth, role('STUDENT'), examController.getMyResult);

export default router;
