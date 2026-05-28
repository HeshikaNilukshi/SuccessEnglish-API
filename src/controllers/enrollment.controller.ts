import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';
import { uploadToCloudinary } from '../utils/cloudinary';

export const requestEnrollment = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'Payment receipt image is required' });
    return;
  }

  const { courseId } = req.body;

  try {
    // 2. Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    // 3. Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      res.status(409).json({ message: 'Already enrolled in this course' });
      return;
    }

    // Upload payment receipt image to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'lms_receipts');

    // 4. Create enrollment with verified: false
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.user.id,
        courseId,
        receiptUrl: cloudinaryResult.secure_url,
        receiptPublicId: cloudinaryResult.public_id,
        verified: false,
      },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Request enrollment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllEnrollments = async (req: Request, res: Response): Promise<void> => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        course: {
          select: {
            name: true,
          },
        },
      },
    });
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Get all enrollments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMyEnrollments = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user.id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });
    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const verifyEnrollment = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { verified } = req.body;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
    });

    if (!enrollment) {
      res.status(404).json({ message: 'Enrollment not found' });
      return;
    }

    const updatedEnrollment = await prisma.enrollment.update({
      where: { id },
      data: { verified },
    });

    res.status(200).json(updatedEnrollment);
  } catch (error) {
    console.error('Verify enrollment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
