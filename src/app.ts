import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import courseRoutes from './routes/course.routes';
import enrollmentRoutes from './routes/enrollment.routes';
import examRoutes from './routes/exam.routes';
import attemptRoutes from './routes/attempt.routes';
import gradingRoutes from './routes/grading.routes';
import videoRoutes from './routes/video.routes';
import studentResultsRoutes from './routes/studentResults.routes';
import materialRoutes from './routes/material.routes';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exams', attemptRoutes);
app.use('/api/exams', gradingRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/student', studentResultsRoutes);
app.use('/api/materials', materialRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;