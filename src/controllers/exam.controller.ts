import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';

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

  const { title, courseId, questions } = req.body;

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
  const courseId = req.params.courseId as string;

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

  const id = req.params.id as string;

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

  const id = req.params.id as string;
  const { title, questions } = req.body;

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
  const id = req.params.id as string;

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

  const id = req.params.id as string;
  const { answers } = req.body;

  try {
    // Check if exam exists
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: { questions: true },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    // Check if student already attempted
    const existingAttempt = await prisma.examAttempt.findUnique({
      where: {
        examId_studentId: {
          examId: id,
          studentId: req.user.id,
        },
      },
    });

    if (existingAttempt) {
      res.status(409).json({ message: 'Already attempted this exam' });
      return;
    }

    // Auto-score
    let score = 0;
    let totalMarks = 0;

    const questionMap = new Map<string, typeof exam.questions[0]>();
    for (const q of exam.questions) {
      questionMap.set(q.id, q);
      totalMarks += q.marks;
    }

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (q) {
        const studentAns = (ans.studentAnswer || '').trim().toLowerCase();
        const correctAns = (q.correctAnswer || '').trim().toLowerCase();
        if (studentAns === correctAns) {
          score += q.marks;
        }
      }
    }

    // Create ExamAttempt with nested answers
    const attempt = await prisma.examAttempt.create({
      data: {
        examId: id,
        studentId: req.user.id,
        score,
        answers: {
          create: answers.map((a: any) => ({
            questionId: a.questionId,
            studentAnswer: a.studentAnswer,
          })),
        },
      },
    });

    res.status(201).json({
      attemptId: attempt.id,
      score,
      totalMarks,
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getExamResults = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

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

  const id = req.params.id as string;

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
