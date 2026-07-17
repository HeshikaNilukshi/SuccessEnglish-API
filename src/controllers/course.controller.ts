import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, description, price } = req.body;

  try {
    const course = await prisma.course.create({
      data: {
        name,
        description,
        price,
        createdBy: req.user.id,
      },
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get all courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
            exams: req.user.role === 'STUDENT' ? { where: { isAdminApproved: true } } : true,
            videos: req.user.role === 'STUDENT' ? { where: { isAdminApproved: true } } : true,
          },
        },
      },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    res.status(200).json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
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
  const { name, description, price } = req.body;

  try {
    const courseExists = await prisma.course.findUnique({
      where: { id },
    });

    if (!courseExists) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && courseExists.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        price: price !== undefined ? price : undefined,
      },
    });

    res.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);

  try {
    const courseExists = await prisma.course.findUnique({
      where: { id },
    });

    if (!courseExists) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && courseExists.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await prisma.enrollment.deleteMany({
      where: { courseId: id },
    });

    await prisma.course.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStudentsByCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = parseInt(req.params.id as string, 10);

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

    const search = req.query.search as string;
    const whereClause: any = { courseId };

    if (search) {
      const searchNum = parseInt(search, 10);
      const isNumeric = !isNaN(searchNum);

      whereClause.user = {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      };

      if (isNumeric) {
        whereClause.user.OR.push({ id: searchNum });
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Get students by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCourseStats = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = parseInt(req.params.id as string, 10);
  if (isNaN(courseId)) {
    res.status(400).json({ message: 'Invalid Course ID' });
    return;
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    const contentWhere: any = { courseId };
    if (req.user.role === 'STUDENT') {
      contentWhere.isAdminApproved = true;
    }

    const [videoCount, examCount, studentCount, resultsCount] = await Promise.all([
      prisma.video.count({
        where: contentWhere
      }),
      prisma.exam.count({
        where: contentWhere
      }),
      prisma.enrollment.count({
        where: { courseId, verified: true }
      }),
      req.user.role === 'STUDENT'
        ? prisma.examAttempt.count({
            where: {
              studentId: req.user.id,
              exam: { courseId }
            }
          })
        : prisma.examAttempt.count({
            where: {
              exam: { courseId }
            }
          })
    ]);

    res.status(200).json({
      videoCount,
      examCount,
      studentCount,
      resultsCount
    });
  } catch (error) {
    console.error('Get course stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
