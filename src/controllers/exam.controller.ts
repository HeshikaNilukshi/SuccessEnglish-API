import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { spawn } from 'child_process';
import path from 'path';
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

export const updateAttemptMarks = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const attemptId = parseInt(req.params.attemptId as string, 10);
  const { answers } = req.body;

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!attempt) {
      res.status(404).json({ message: 'Attempt not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && attempt.exam.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const ans of answers) {
        const dataToUpdate: any = {};
        if (ans.marksAwarded !== undefined) dataToUpdate.marksAwarded = ans.marksAwarded;
        if (ans.similarity !== undefined) dataToUpdate.similarity = ans.similarity;
        if (ans.feedback !== undefined) dataToUpdate.feedback = ans.feedback;

        if (Object.keys(dataToUpdate).length > 0) {
          await tx.answer.update({
            where: { id: ans.answerId },
            data: dataToUpdate,
          });
        }
      }
    });

    const updatedAnswers = await prisma.answer.findMany({
      where: { attemptId },
      include: {
        question: true,
      },
    });

    let totalScore = 0;
    for (const ans of updatedAnswers) {
      if (ans.marksAwarded) {
        totalScore += ans.marksAwarded;
      }
    }

    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        isGraded: true,
      },
      include: {
        answers: true,
      },
    });

    res.status(200).json(updatedAttempt);
  } catch (error) {
    console.error('Update attempt marks error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const evaluateAnswerWithAI = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const answerId = parseInt(req.params.answerId as string, 10);

  try {
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      include: {
        question: true,
        attempt: {
          include: { exam: { include: { course: true } } }
        }
      }
    });

    if (!answer) {
      res.status(404).json({ message: 'Answer not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && answer.attempt.exam.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const evaluationData = {
      questionText: answer.question.questionText,
      studentAnswer: answer.studentAnswer,
      modelAnswer: answer.question.correctAnswer,
      maxMarks: answer.question.marks
    };

    const isWindows = process.platform === 'win32';

    const pythonExecutable = process.env.PYTHON_VENV_PATH || path.join(__dirname, '..', '..', 'venv', isWindows ? 'Scripts' : 'bin', 'python');
    const scriptPath = path.join(__dirname, '..', 'scripts', 'evaluate.py');

    const pythonProcess = spawn(pythonExecutable, [scriptPath, JSON.stringify(evaluationData)], {
      shell: false
    });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}: ${errorData}`);
        res.status(500).json({ message: 'AI Evaluation failed', error: errorData });
        return;
      }

      try {
        const result = JSON.parse(outputData);
        res.status(200).json(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', outputData);
        res.status(500).json({ message: 'Invalid AI response format' });
      }
    });

  } catch (error) {
    console.error('Evaluate AI error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const evaluateAttemptWithAI = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const attemptId = parseInt(req.params.attemptId as string, 10);

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { course: true } },
        answers: { include: { question: true } }
      }
    });

    if (!attempt) {
      res.status(404).json({ message: 'Attempt not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && attempt.exam.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const evaluationData = attempt.answers.map(ans => ({
      answerId: ans.id,
      questionText: ans.question.questionText,
      studentAnswer: ans.studentAnswer,
      modelAnswer: ans.question.correctAnswer,
      maxMarks: ans.question.marks
    }));

    if (evaluationData.length === 0) {
      res.status(400).json({ message: 'No answers found in this attempt to evaluate' });
      return;
    }

    const isWindows = process.platform === 'win32';
    const pythonExecutable = process.env.PYTHON_VENV_PATH || path.join(__dirname, '..', '..', 'venv', isWindows ? 'Scripts' : 'bin', 'python');
    const scriptPath = path.join(__dirname, '..', 'scripts', 'evaluate.py');

    const pythonProcess = spawn(pythonExecutable, [scriptPath, JSON.stringify(evaluationData)], {
      shell: false
    });

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}: ${errorData}`);
        res.status(500).json({ message: 'AI Evaluation failed', error: errorData });
        return;
      }

      try {
        const results = JSON.parse(outputData);
        const finalResults = results.map((result: any, index: number) => ({
          answerId: evaluationData[index].answerId,
          ...result
        }));

        res.status(200).json(finalResults);
      } catch (parseError) {
        console.error('Failed to parse Python output:', outputData);
        res.status(500).json({ message: 'Invalid AI response format' });
      }
    });

  } catch (error) {
    console.error('Evaluate Attempt AI error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
