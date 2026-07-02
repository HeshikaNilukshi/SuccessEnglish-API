import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { spawn } from 'child_process';
import path from 'path';
import prisma from '../config/db';

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
    const scriptPath = path.join(__dirname, '..', 'ml', 'evaluate.py');

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
    const pythonExecutable = path.join(__dirname, '..', '..', 'venv', isWindows ? 'Scripts' : 'bin', 'python');
    const scriptPath = path.join(__dirname, '..', 'ml', 'evaluate.py');

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

        console.log('AI Batch Grading Result:', finalResults);
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