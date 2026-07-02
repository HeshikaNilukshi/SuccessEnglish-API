import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';

export const startExam = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    const existingAttempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: id,
          studentId: req.user.id,
        },
      },
      include: {
        _count: {
          select: { answers: true },
        },
      },
    });

    if (existingAttempt) {
      if (existingAttempt._count.answers > 0) {
        res.status(409).json({ message: 'Already submitted this exam' });
        return;
      }

      if (exam.duration > 0) {
        const deadlineMs = existingAttempt.createdAt.getTime() + exam.duration * 60 * 1000;
        const now = Date.now();
        if (now > deadlineMs) {
          res.status(403).json({ message: 'Submission deadline has passed.' });
          return;
        }
      }

      const deadline = exam.duration > 0
        ? new Date(existingAttempt.createdAt.getTime() + exam.duration * 60 * 1000)
        : null;

      res.status(200).json({
        attemptId: existingAttempt.id,
        startedAt: existingAttempt.createdAt,
        deadline,
      });
      return;
    }

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: id,
        studentId: req.user.id,
        score: null,
      },
    });

    const deadline = exam.duration > 0
      ? new Date(attempt.createdAt.getTime() + exam.duration * 60 * 1000)
      : null;

    res.status(201).json({
      attemptId: attempt.id,
      startedAt: attempt.createdAt,
      deadline,
    });
  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const submitExam = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  const { answers } = req.body;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: id,
          studentId: req.user.id,
        },
      },
      include: { _count: { select: { answers: true } } },
    });

    if (!attempt) {
      res.status(400).json({ message: 'Exam not started' });
      return;
    }

    if (attempt._count.answers > 0) {
      res.status(409).json({ message: 'Already submitted this exam' });
      return;
    }

    if (exam.duration > 0) {
      const deadlineMs = attempt.createdAt.getTime() + exam.duration * 60 * 1000;
      const graceMs = 60 * 1000;
      const now = Date.now();

      if (now > deadlineMs + graceMs) {
        res.status(403).json({ message: 'Submission deadline has passed.' });
        return;
      }
    }

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: {
          create: answers.map((a: any) => ({
            questionId: parseInt(a.questionId, 10),
            studentAnswer: a.studentAnswer,
          })),
        },
      },
    });

    res.status(200).json({
      attemptId: updatedAttempt.id,
      message: 'Exam submitted successfully',
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getExamResults = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);

  try {
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: id },
      include: {
        student: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMyResult = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: id,
          studentId: req.user.id,
        },
      },
      include: {
        answers: {
          include: {
            question: {
              select: {
                questionText: true,
                marks: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ message: 'Result not found' });
      return;
    }

    res.status(200).json(attempt);
  } catch (error) {
    console.error('Get my result error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllResultsByCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = parseInt(req.params.courseId as string, 10);

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        exam: {
          courseId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error('Get all results by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStudentResultsByCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = parseInt(req.params.courseId as string, 10);
  const studentId = parseInt(req.params.studentId as string, 10);

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        exam: {
          courseId,
        },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error('Get student results by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMyResultsByCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = parseInt(req.params.courseId as string, 10);
  const studentId = req.user.id;

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    const attempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        exam: {
          courseId,
        },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.error('Get my results by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAttemptWithAnswers = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const attemptId = parseInt(req.params.attemptId as string, 10);

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        exam: {
          include: {
            course: true,
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ message: 'Attempt not found' });
      return;
    }

    if (req.user.role === 'STUDENT' && attempt.studentId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (req.user.role === 'TEACHER' && attempt.exam.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    res.status(200).json(attempt);
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

