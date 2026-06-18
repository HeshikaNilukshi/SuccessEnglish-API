import dotenv from 'dotenv';
dotenv.config();
import prisma from '../config/db';

async function run() {
  try {
    const answers = await prisma.answer.findMany({
      select: { id: true, studentAnswer: true }
    });
    console.log("Answers in DB:", JSON.stringify(answers, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
