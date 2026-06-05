import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import prisma from '../config/db';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, email, password, role } = req.body;

  try {
    // Check if email already exists -> 409 Conflict
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ message: 'Email already exists' });
      return;
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
      select: userSelect,
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: userSelect,
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMe = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, email, password } = req.body;

  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    
    if (email) {
      // Check if email already taken by someone else
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user.id },
        },
      });

      if (existingUser) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
      updateData.email = email;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: userSelect,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const id = parseInt(req.params.id as string, 10);
  const { name, email, password, role } = req.body;

  try {
    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { id },
    });

    if (!userExists) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      });

      if (existingUser) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
      updateData.email = email;
    }

    if (role) updateData.role = role;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);

  try {
    const userExists = await prisma.user.findUnique({
      where: { id },
    });

    if (!userExists) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
