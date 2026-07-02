import { Router } from 'express';
import { body } from 'express-validator';
import * as attemptController from '../controllers/attempt.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

router.get('/course/:courseId/results', auth, role('ADMIN', 'TEACHER'), attemptController.getAllResultsByCourse);
router.get('/course/:courseId/student/:studentId/results', auth, role('ADMIN', 'TEACHER'), attemptController.getStudentResultsByCourse);
router.get('/course/:courseId/my-results', auth, role('STUDENT'), attemptController.getMyResultsByCourse);
router.get('/attempt/:attemptId', auth, role('ADMIN', 'TEACHER', 'STUDENT'), attemptController.getAttemptWithAnswers);

router.post('/:id/start', auth, role('STUDENT'), attemptController.startExam);

router.post(
  '/:id/submit',
  auth,
  role('STUDENT'),
  [
    body('answers').isArray().withMessage('Answers must be an array'),
    body('answers.*.questionId').isInt().withMessage('questionId must be an integer'),
    body('answers.*.studentAnswer').notEmpty().withMessage('studentAnswer is required'),
  ],
  attemptController.submitExam
);

router.get('/:id/results', auth, role('ADMIN', 'TEACHER'), attemptController.getExamResults);
router.get('/:id/my-result', auth, role('STUDENT'), attemptController.getMyResult);

export default router;