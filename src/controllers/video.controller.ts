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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { courseId, title, videoUrl, publicId } = req.body;

  try {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
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
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ message: 'Course not found' });
      return;
    }

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

    // Latest videos need to be come to top (createdAt DESC)
    const videos = await prisma.video.findMany({
      where: { courseId },
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

  try {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    // If student, check verified enrollment
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  const { title, videoUrl, publicId } = req.body;

  try {
    const existingVideo = await prisma.video.findUnique({
      where: { id },
    });

    if (!existingVideo) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;

    if (videoUrl && publicId) {
      // Delete old video from Cloudinary
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
  const id = parseInt(req.params.id as string, 10);

  try {
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(video.publicId);

    // Delete from DB
    await prisma.video.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
