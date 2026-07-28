import { Router } from 'express';
import { body } from 'express-validator';
import * as gradingController from '../controllers/grading.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.put(
  '/attempt/:attemptId',
  auth,
  role('ADMIN', 'TEACHER'),
  [
    body('answers').isArray().withMessage('Answers must be an array'),
    body('answers.*.answerId').isInt().withMessage('answerId must be an integer'),
    body('answers.*.marksAwarded').optional().isInt({ min: 0 }).withMessage('marksAwarded must be a non-negative integer'),
    body('answers.*.similarity').optional().isFloat({ min: 0, max: 1 }).withMessage('similarity must be a float between 0 and 1'),
    body('answers.*.feedback').optional().isString().withMessage('feedback must be a string'),
  ],
  gradingController.updateAttemptMarks
);

router.post(
  '/answer/:answerId/evaluate-ai',
  auth,
  role('ADMIN', 'TEACHER'),
  gradingController.evaluateAnswerWithAI
);

router.post(
  '/attempt/:attemptId/evaluate-ai',
  auth,
  role('ADMIN', 'TEACHER'),
  gradingController.evaluateAttemptWithAI
);

export default router;
