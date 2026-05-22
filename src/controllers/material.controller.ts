import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';

export const uploadMaterial = async (req: Request, res: Response): Promise<void> => {
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
    res.status(400).json({ message: 'File is required' });
    return;
  }

  const { courseId, title, fileType } = req.body;

  try {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'lms_materials');

    // Create DB record
    const material = await prisma.courseMaterial.create({
      data: {
        courseId,
        uploadedBy: req.user.id,
        title,
        fileUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        fileType,
      },
    });

    res.status(201).json(material);
  } catch (error) {
    console.error('Upload material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMaterialsByCourse = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const courseId = req.params.courseId as string;

  try {
    // If student, check verified enrollment
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

    const materials = await prisma.courseMaterial.findMany({
      where: { courseId },
    });

    res.status(200).json(materials);
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const downloadMaterial = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;

  try {
    const material = await prisma.courseMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      res.status(404).json({ message: 'Material not found' });
      return;
    }

    // If student, check verified enrollment
    if (req.user.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: material.courseId,
          },
        },
      });

      if (!enrollment || !enrollment.verified) {
        res.status(403).json({ message: 'Access denied: You must be a verified enrolled student' });
        return;
      }
    }

    res.redirect(material.fileUrl);
  } catch (error) {
    console.error('Download material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMaterial = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const id = req.params.id as string;
  const { title } = req.body;

  try {
    const material = await prisma.courseMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      res.status(404).json({ message: 'Material not found' });
      return;
    }

    const updateData: any = {};
    if (title) updateData.title = title;

    if (req.file) {
      // Delete old file
      await deleteFromCloudinary(material.publicId);

      // Upload new file
      const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'lms_materials');
      updateData.fileUrl = cloudinaryResult.secure_url;
      updateData.publicId = cloudinaryResult.public_id;
    }

    const updatedMaterial = await prisma.courseMaterial.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(updatedMaterial);
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteMaterial = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    const material = await prisma.courseMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      res.status(404).json({ message: 'Material not found' });
      return;
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(material.publicId);

    // Delete from DB
    await prisma.courseMaterial.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
