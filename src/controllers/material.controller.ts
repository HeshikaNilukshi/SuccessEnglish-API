import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';
import { deleteFromCloudinary } from '../utils/cloudinary';

export const saveMaterial = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, url, publicId } = req.body;
  const videoId = parseInt(req.body.videoId, 10);

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { course: true },
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && video.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const material = await prisma.material.create({
      data: {
        videoId,
        name,
        url,
        publicId,
      },
    });

    res.status(201).json(material);
  } catch (error) {
    console.error('Save material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMaterialsByVideo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const videoId = parseInt(req.params.videoId as string, 10);

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { course: true },
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    if (req.user.role === 'STUDENT') {
      if (!video.isAdminApproved) {
        res.status(403).json({ message: 'Access denied: Video is not approved' });
        return;
      }

      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: video.courseId,
          },
        },
      });

      if (!enrollment || !enrollment.verified) {
        res.status(403).json({ message: 'Access denied: You must be a verified enrolled student' });
        return;
      }
    }

    const materials = await prisma.material.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(materials);
  } catch (error) {
    console.error('Get materials by video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMaterial = async (req: Request, res: Response): Promise<void> => {
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
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid ID' });
    return;
  }
  const { name, url, publicId } = req.body;

  try {
    const existingMaterial = await prisma.material.findUnique({
      where: { id },
      include: { video: { include: { course: true } } },
    });

    if (!existingMaterial) {
      res.status(404).json({ message: 'Material not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && existingMaterial.video.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;

    if (url && publicId) {
      await deleteFromCloudinary(existingMaterial.publicId);
      updateData.url = url;
      updateData.publicId = publicId;
    }

    const updatedMaterial = await prisma.material.update({
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
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid ID' });
    return;
  }

  try {
    const material = await prisma.material.findUnique({
      where: { id },
      include: { video: { include: { course: true } } },
    });

    if (!material) {
      res.status(404).json({ message: 'Material not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && material.video.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await deleteFromCloudinary(material.publicId);

    await prisma.material.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
