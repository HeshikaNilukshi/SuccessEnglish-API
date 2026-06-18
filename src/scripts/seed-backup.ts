import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/db';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Starting data seed from backup...');

  const backupDir = path.join(__dirname, '../../backup');

  // Helper to read backup JSON
  const readBackup = (filename: string) => {
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Backup file ${filename} not found.`);
      return [];
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };

  const users = readBackup('user.json');
  const courses = readBackup('course.json');
  const enrollments = readBackup('enrollment.json');
  const videos = readBackup('video.json');
  const exams = readBackup('exam.json');
  const questions = readBackup('question.json');
  const examAttempts = readBackup('examAttempt.json');
  const answers = readBackup('answer.json');

  console.log('Read all backup files.');

  // Disable foreign key checks
  console.log('Disabling foreign key checks...');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

  try {
    // Truncate existing tables
    const tables = ['Answer', 'ExamAttempt', 'Question', 'Exam', 'Video', 'Enrollment', 'Course', 'User'];
    for (const table of tables) {
      console.log(`Deleting existing records from table ${table}...`);
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
    }

    // Insert Users
    if (users.length > 0) {
      console.log(`Seeding ${users.length} users...`);
      await prisma.user.createMany({
        data: users.map((u: any) => ({
          ...u,
          createdAt: new Date(u.createdAt)
        }))
      });
    }

    // Insert Courses
    if (courses.length > 0) {
      console.log(`Seeding ${courses.length} courses...`);
      await prisma.course.createMany({
        data: courses.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt)
        }))
      });
    }

    // Insert Enrollments
    if (enrollments.length > 0) {
      console.log(`Seeding ${enrollments.length} enrollments...`);
      await prisma.enrollment.createMany({
        data: enrollments.map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt)
        }))
      });
    }

    // Insert Videos
    if (videos.length > 0) {
      console.log(`Seeding ${videos.length} videos...`);
      await prisma.video.createMany({
        data: videos.map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt)
        }))
      });
    }

    // Insert Exams
    if (exams.length > 0) {
      console.log(`Seeding ${exams.length} exams...`);
      await prisma.exam.createMany({
        data: exams.map((ex: any) => ({
          ...ex,
          createdAt: new Date(ex.createdAt)
        }))
      });
    }

    // Insert Questions
    if (questions.length > 0) {
      console.log(`Seeding ${questions.length} questions...`);
      await prisma.question.createMany({
        data: questions
      });
    }

    // Insert Exam Attempts
    if (examAttempts.length > 0) {
      console.log(`Seeding ${examAttempts.length} exam attempts...`);
      await prisma.examAttempt.createMany({
        data: examAttempts.map((ea: any) => ({
          ...ea,
          createdAt: new Date(ea.createdAt)
        }))
      });
    }

    // Insert Answers
    if (answers.length > 0) {
      console.log(`Seeding ${answers.length} answers...`);
      await prisma.answer.createMany({
        data: answers
      });
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    // Re-enable foreign key checks
    console.log('Re-enabling foreign key checks...');
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    await prisma.$disconnect();
  }
}

main();
