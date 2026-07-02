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

  const { title, questions } = req.body;
  const courseId = parseInt(req.body.courseId, 10);
  const duration = parseInt(req.body.duration, 10) || 0;
  const passMark = parseInt(req.body.passMark, 10) || 0;

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

    const exam = await prisma.exam.create({
      data: {
        title,
        courseId,
        duration: duration || 0,
        passMark: passMark || 0,
        createdBy: req.user.id,
        questions: {
          create: questions.map((q: any) => ({
            questionText: q.questionText,
            correctAnswer: q.correctAnswer,
            marks: parseInt(q.marks, 10),
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

    if (req.user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId,
          },
        },
      });

      if (!enrollment || !enrollment.verified) {
        res.status(403).json({ message: 'Access denied: You must be a verified enrolled student' });
        return;
      }
    }

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
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    if (req.user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: exam.courseId,
          },
        },
      });

      if (!enrollment || !enrollment.verified) {
        res.status(403).json({ message: 'Access denied: You must be a verified enrolled student' });
        return;
      }

      const attempt = await prisma.examAttempt.findUnique({
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

      const sanitizedQuestions = exam.questions.map((q) => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });
      const studentInfo = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true },
      });
      res.status(200).json({
        ...exam,
        questions: sanitizedQuestions,
        totalQuestions: exam.questions.length,
        studentId: req.user.id,
        studentName: studentInfo?.name || '',
        attempt: attempt ? {
          id: attempt.id,
          submitted: attempt._count.answers > 0,
          deadlinePassed: exam.duration > 0 && (Date.now() > attempt.createdAt.getTime() + exam.duration * 60 * 1000),
          isGraded: attempt.isGraded,
        } : null
      });
      return;
    }

    res.status(200).json({
      ...exam,
      totalQuestions: exam.questions.length,
    });
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
  const { title, questions } = req.body;
  const duration = req.body.duration !== undefined ? parseInt(req.body.duration, 10) : undefined;
  const passMark = req.body.passMark !== undefined ? parseInt(req.body.passMark, 10) : undefined;

  try {
    const examExists = await prisma.exam.findUnique({
      where: { id },
    });

    if (!examExists) {
      res.status(404).json({ message: 'Exam not found' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (req.user.role === 'TEACHER' && examExists.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    let updatedExam;

    if (questions) {
      updatedExam = await prisma.$transaction(async (tx) => {
        await tx.question.deleteMany({
          where: { examId: id },
        });

        return await tx.exam.update({
          where: { id },
          data: {
            title: title || undefined,
            duration: duration !== undefined ? duration : undefined,
            passMark: passMark !== undefined ? passMark : undefined,
            questions: {
              create: questions.map((q: any) => ({
                questionText: q.questionText,
                correctAnswer: q.correctAnswer,
                marks: parseInt(q.marks, 10),
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
          passMark: passMark !== undefined ? passMark : undefined,
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

    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (req.user.role === 'TEACHER' && examExists.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
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

