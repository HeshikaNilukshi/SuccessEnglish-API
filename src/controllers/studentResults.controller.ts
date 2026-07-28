import { Request, Response } from 'express';
import prisma from '../config/db';

export const getStudentDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = parseInt(req.params.id as string, 10);

    if (isNaN(studentId)) {
      res.status(400).json({ message: 'Invalid student ID' });
      return;
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true }
    });

    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        isGraded: true,
      },
      include: {
        exam: {
          include: {
            course: true,
          }
        }
      },
      orderBy: {
        createdAt: 'asc',
      }
    });

    const areaChartData = attempts.map(attempt => ({
      attemptId: attempt.id,
      examTitle: attempt.exam.title,
      courseName: attempt.exam.course.name,
      score: attempt.score || 0,
      date: attempt.createdAt.toISOString(),
    }));

    res.status(200).json({
      studentName: student.name,
      areaChartData,
    });
  } catch (error) {
    console.error("Error fetching student results:", error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
