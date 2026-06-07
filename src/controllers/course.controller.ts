import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';

export const createCourse = async (req: Request, res: Response): Promise<void> => {
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
    const courses = await prisma.course.findMany();
    res.status(200).json(courses);
  } catch (error) {
    console.error('Get all courses error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCourse = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            enrollments: true,
            exams: true,
            videos: true,
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
  const id = parseInt(req.params.id as string, 10);

  try {
    const courseExists = await prisma.course.findUnique({
      where: { id },
    });

    if (!courseExists) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    // Manually delete related enrollments first to satisfy foreign key constraints
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
