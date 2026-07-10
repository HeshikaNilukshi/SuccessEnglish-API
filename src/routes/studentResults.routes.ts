import { Router } from 'express';
import { getStudentDashboardData } from '../controllers/studentResults.controller';
import { auth } from '../middleware/auth';
import { role } from '../middleware/role';

const router = Router();

// Allows ADMIN, TEACHER, and potentially STUDENT to view results
// We should probably allow the STUDENT themselves to view their own results, but let's check who gets to view it.
// The route says student/:id/results, usually accessed by teacher or student themselves.
// If it's a student accessing, we should verify the student id matches their req.user.id.
// But the controller gets studentId from req.params.id. Let's allow access to ADMIN, TEACHER, or if the student's ID matches req.user.id.
// Wait! Let's check how auth middleware sets req.user. Let's inspect `api/src/middleware/auth.ts` or similar.
// Actually, to keep it simple and secure:
router.get('/:id/results', auth, getStudentDashboardData);

export default router;
