import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import prisma from '../config/db';

const coursesToSeed = [
  {
    name: "Grade 10 English",
    description:
      "A comprehensive English language course tailored for O/L (Ordinary Level) students in Sri Lanka. Covers grammar, reading comprehension, letter and essay writing, poetry analysis, and exam technique aligned with the Sri Lankan O/L syllabus.",
    price: 2500.00,
  },
  {
    name: "Grade 11 English",
    description:
      "An advanced English course for Grade 11 students preparing for the Sri Lankan O/L examination. Focuses on higher-order writing skills, literary analysis, formal and informal communication, and past paper practice to maximise exam performance.",
    price: 2750.00,
  },
  {
    name: "Spoken English",
    description:
      "A practical conversational English course designed for all age groups in Sri Lanka. Builds confidence in everyday speaking, pronunciation, vocabulary, and interpersonal communication through interactive exercises, role-plays, and guided discussions.",
    price: 1800.00,
  },
];

async function main() {
  console.log("🌱 Starting course seeding...\n");

  const hashedPassword = await bcrypt.hash("teacher123", 10);
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@lms.com" },
    update: {},
    create: {
      name: "Teacher John",
      email: "teacher@lms.com",
      password: hashedPassword,
      role: "TEACHER",
    },
  });

  const adminHashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@lms.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@lms.com",
      password: adminHashedPassword,
      role: "ADMIN",
    },
  });

  for (const course of coursesToSeed) {
    const existing = await prisma.course.findFirst({
      where: { name: course.name },
    });

    if (existing) {
      const updated = await prisma.course.update({
        where: { id: existing.id },
        data: {
          description: course.description,
          price: course.price,
          createdBy: teacher.id,
        },
      });
      console.log(`Updated course: "${updated.name}"`);
    } else {
      const created = await prisma.course.create({
        data: {
          name: course.name,
          description: course.description,
          price: course.price,
          createdBy: teacher.id,
        },
      });
      console.log(`Created course: "${created.name}"`);
    }
  }

  const spokenEnglish = await prisma.course.findFirst({
    where: { name: "Spoken English" },
  });

  if (spokenEnglish) {
    const existingExam = await prisma.exam.findFirst({
      where: {
        courseId: spokenEnglish.id,
        title: "Spoken English Final Assessment",
      },
    });

    if (!existingExam) {
      await prisma.exam.create({
        data: {
          title: "Spoken English Final Assessment",
          duration: 45,
          passMark: 50,
          courseId: spokenEnglish.id,
          createdBy: teacher.id,
          questions: {
            create: [
              {
                questionText: "What is the most appropriate response to 'How do you do?' in a formal setting?",
                correctAnswer: "How do you do? or Pleasure to meet you.",
                marks: 10,
              },
              {
                questionText: "Correct the error in this sentence: 'He don't know the answer.'",
                correctAnswer: "He doesn't know the answer.",
                marks: 10,
              },
              {
                questionText: "What is the difference in meaning between 'say' and 'tell'?",
                correctAnswer: "'Say' focuses on the words spoken, while 'tell' focuses on giving information to a person (e.g., 'Say hello' vs. 'Tell me a story').",
                marks: 10,
              },
              {
                questionText: "Which word has a silent letter: 'Climb', 'Listen', or both?",
                correctAnswer: "Both (b in Climb, t in Listen)",
                marks: 10,
              },
              {
                questionText: "Give an example of a polite way to interrupt someone during a meeting or discussion.",
                correctAnswer: "Excuse me, may I add something here? or Sorry to interrupt, but...",
                marks: 10,
              },
              {
                questionText: "What is the contracted form of 'I will not'?",
                correctAnswer: "I won't",
                marks: 10,
              },
              {
                questionText: "Complete the phrase: 'Looking forward to _______ you soon.' (meet / meeting)",
                correctAnswer: "meeting",
                marks: 10,
              },
              {
                questionText: "What intonation (rising or falling) is typically used for a Yes/No question?",
                correctAnswer: "Rising intonation",
                marks: 10,
              },
              {
                questionText: "Rewrite this request to make it more polite: 'Give me the salt.'",
                correctAnswer: "Could you please pass the salt? or Would you mind passing the salt?",
                marks: 10,
              },
              {
                questionText: "What does the idiom 'break a leg' mean in a performance/speaking context?",
                correctAnswer: "Good luck",
                marks: 10,
              },
            ],
          },
        },
      });
      console.log(`Created exam for "Spoken English"`);
    } else {
      console.log(`Exam for "Spoken English" already exists.`);
    }
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
