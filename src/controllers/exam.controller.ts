import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';

// Allow 30 seconds extra after the deadline to account for network delays
const GRACE_PERIOD_SECONDS = 60;

export const createExam = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { title, courseId, duration, questions } = req.body;

  try {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    // Create exam with nested questions
    const exam = await prisma.exam.create({
      data: {
        title,
        courseId,
        duration: duration || 0,
        createdBy: req.user.id,
        questions: {
          create: questions.map((q: any) => ({
            questionText: q.questionText,
            correctAnswer: q.correctAnswer,
            marks: q.marks,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    res.status(201).json(exam);
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getExamsByCourse = async (req: Request, res: Response): Promise<void> => {
  const courseId = parseInt(req.params.courseId as string, 10);

  try {
    const exams = await prisma.exam.findMany({
      where: { courseId },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    res.status(200).json(exams);
  } catch (error) {
    console.error('Get exams by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getExam = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        questions: true,
      },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    // If student, strip correct answers
    if (req.user.role === 'STUDENT') {
      const sanitizedQuestions = exam.questions.map((q) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });
      res.status(200).json({
        ...exam,
        questions: sanitizedQuestions,
      });
      return;
    }

    res.status(200).json(exam);
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateExam = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  const { title, duration, questions } = req.body;

  try {
    const examExists = await prisma.exam.findUnique({
      where: { id },
    });

    if (!examExists) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    let updatedExam;

    if (questions) {
      // Use transaction to delete existing questions and create new ones
      updatedExam = await prisma.$transaction(async (tx) => {
        // Delete all existing questions for this exam
        await tx.question.deleteMany({
          where: { examId: id },
        });

        // Update exam details and create new questions
        return await tx.exam.update({
          where: { id },
          data: {
            title: title || undefined,
            duration: duration !== undefined ? duration : undefined,
            questions: {
              create: questions.map((q: any) => ({
                questionText: q.questionText,
                correctAnswer: q.correctAnswer,
                marks: q.marks,
              })),
            },
          },
          include: {
            questions: true,
          },
        });
      });
    } else {
      updatedExam = await prisma.exam.update({
        where: { id },
        data: {
          title: title || undefined,
          duration: duration !== undefined ? duration : undefined,
        },
        include: {
          questions: true,
        },
      });
    }

    res.status(200).json(updatedExam);
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteExam = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);

  try {
    const examExists = await prisma.exam.findUnique({
      where: { id },
    });

    if (!examExists) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    await prisma.exam.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const startExam = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    // Check if exam exists
    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    // Check if student already started this exam
    const existingAttempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: id,
          studentId: req.user.id,
        },
      },
    });

    if (existingAttempt) {
      res.status(409).json({ message: 'Already started this exam' });
      return;
    }

    // Create attempt record — this marks the start time via createdAt
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: id,
        studentId: req.user.id,
        score: null,
      },
    });

    // Calculate deadline for the frontend countdown timer
    // If duration is 0, there is no time limit
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
    // Check if exam exists
    const exam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    // Find the existing attempt (created by startExam)
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

    // Check if already submitted (has answers means already submitted)
    if (attempt._count.answers > 0) {
      res.status(409).json({ message: 'Already submitted this exam' });
      return;
    }

    // Enforce deadline: if duration > 0, check that we are within the allowed time + grace period
    if (exam.duration > 0) {
      const deadlineMs = attempt.createdAt.getTime() + exam.duration * 60 * 1000;
      const graceMs = GRACE_PERIOD_SECONDS * 1000;
      const now = Date.now();

      if (now > deadlineMs + graceMs) {
        res.status(403).json({ message: 'Time is up. Submission deadline has passed.' });
        return;
      }
    }

    // Save answers
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: {
          create: answers.map((a: any) => ({
            questionId: a.questionId,
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
