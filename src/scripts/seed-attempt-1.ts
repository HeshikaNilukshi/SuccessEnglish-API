import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/db';

async function run() {
  console.log('Seeding exam attempt for exam 1, user 6...');

  // 1. Ensure User 6 exists
  let user = await prisma.user.findUnique({
    where: { id: 6 }
  });

  if (!user) {
    console.log('User 6 not found, creating user 6...');
    // Create User with ID 6
    user = await prisma.user.create({
      data: {
        id: 6,
        name: 'Kasun Silva',
        email: 'kasun.silva.seeded@gmail.com',
        password: 'securepassword',
        role: 'STUDENT'
      }
    });
  }
  console.log(`Using User: ${user.name} (ID: ${user.id}, Role: ${user.role})`);

  // 2. Ensure Exam 1 exists
  const exam = await prisma.exam.findUnique({
    where: { id: 1 },
    include: { questions: true }
  });

  if (!exam) {
    console.error('❌ Exam with ID 1 does not exist in the database!');
    process.exit(1);
  }
  console.log(`Using Exam: "${exam.title}" (ID: ${exam.id}) with ${exam.questions.length} questions.`);

  if (exam.questions.length === 0) {
    console.error('❌ Exam with ID 1 has no questions to answer!');
    process.exit(1);
  }

  // 3. Clean up existing attempt if any
  const existingAttempt = await prisma.examAttempt.findUnique({
    where: {
      examId_studentId: {
        examId: 1,
        studentId: 6
      }
    }
  });

  if (existingAttempt) {
    console.log(`Found existing attempt (ID: ${existingAttempt.id}), deleting to avoid unique constraint conflict...`);
    await prisma.answer.deleteMany({
      where: { attemptId: existingAttempt.id }
    });
    await prisma.examAttempt.delete({
      where: { id: existingAttempt.id }
    });
  }

  // 4. Create new ExamAttempt
  const attempt = await prisma.examAttempt.create({
    data: {
      examId: 1,
      studentId: 6,
      score: null,
      isGraded: false
    }
  });
  console.log(`Created ExamAttempt ID: ${attempt.id}`);

  // 5. Seed Answers for each question
  // We'll generate answers that are slightly different from model answers to demonstrate AI grading.
  for (const question of exam.questions) {
    let studentAnswer = '';
    // Generate different answers based on some keywords or a default variation
    if (question.correctAnswer.toLowerCase().includes('paris')) {
      studentAnswer = 'The capital city of France is Paris.';
    } else if (question.correctAnswer.toLowerCase().includes('programming language')) {
      studentAnswer = 'It is a language used for writing computer programs.';
    } else {
      // General variation: prefix with "I believe the answer is..."
      studentAnswer = `I think the answer is ${question.correctAnswer.toLowerCase()}`;
    }

    const answer = await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        studentAnswer,
        similarity: null // to be graded by teacher/AI
      }
    });
    console.log(`  - Answer seeded for Question ID ${question.id}: "${studentAnswer}" (Model: "${question.correctAnswer}")`);
  }

  console.log('🎉 Exam attempt seeded successfully!');
}

run()
  .catch((err) => {
    console.error('❌ Seeding attempt failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
