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
