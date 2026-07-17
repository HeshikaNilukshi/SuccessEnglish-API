import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import prisma from '../config/db';
import { generateSignedUploadParams, deleteFromCloudinary } from '../utils/cloudinary';

export const getUploadSignature = async (req: Request, res: Response): Promise<void> => {
  try {
    const params = generateSignedUploadParams('lms_videos');
    res.status(200).json(params);
  } catch (error) {
    console.error('Get upload signature error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const saveVideo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { title, videoUrl, publicId } = req.body;
  const courseId = parseInt(req.body.courseId, 10);

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

    const video = await prisma.video.create({
      data: {
        courseId,
        title,
        videoUrl,
        publicId,
      },
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Save video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideosByCourse = async (req: Request, res: Response): Promise<void> => {
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

    const whereClause: any = { courseId };
    if (req.user.role === 'STUDENT') {
      whereClause.isAdminApproved = true;
    }

    const videos = await prisma.video.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(videos);
  } catch (error) {
    console.error('Get videos by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVideo = async (req: Request, res: Response): Promise<void> => {
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
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    if (req.user.role === 'STUDENT' && !video.isAdminApproved) {
      res.status(403).json({ message: 'Access denied: Video is not approved' });
      return;
    }

    if (req.user.role === 'STUDENT') {
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

    res.status(200).json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateVideo = async (req: Request, res: Response): Promise<void> => {
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
  const { title, videoUrl, publicId } = req.body;

  try {
    const existingVideo = await prisma.video.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!existingVideo) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    if (req.user.role === 'TEACHER' && existingVideo.course.createdBy !== req.user.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;

    if (videoUrl && publicId) {
      await deleteFromCloudinary(existingVideo.publicId);
      updateData.videoUrl = videoUrl;
      updateData.publicId = publicId;
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(updatedVideo);
  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteVideo = async (req: Request, res: Response): Promise<void> => {
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
    const video = await prisma.video.findUnique({
      where: { id },
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

    await deleteFromCloudinary(video.publicId);

    await prisma.video.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const toggleVideoApproval = async (req: Request, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: 'Invalid ID' });
    return;
  }

  const { isAdminApproved } = req.body;

  if (typeof isAdminApproved !== 'boolean') {
    res.status(400).json({ message: 'isAdminApproved must be a boolean' });
    return;
  }

  try {
    const existingVideo = await prisma.video.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    const updatedVideo = await prisma.video.update({
      where: { id },
      data: { isAdminApproved },
    });

    res.status(200).json(updatedVideo);
  } catch (error) {
    console.error('Toggle video approval error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
