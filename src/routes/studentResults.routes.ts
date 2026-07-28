import { Router } from 'express';
import { getStudentDashboardData } from '../controllers/studentResults.controller';
import { auth } from '../middleware/auth';

const router = Router();

router.get('/:id/results', auth, getStudentDashboardData);

export default router;
