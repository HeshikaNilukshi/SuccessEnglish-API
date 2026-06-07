import dotenv from 'dotenv';
dotenv.config();

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

  for (const course of coursesToSeed) {
    const existing = await prisma.course.findFirst({
      where: { name: course.name },
    });

    if (existing) {
      // Update the existing record with the latest data
      const updated = await prisma.course.update({
        where: { id: existing.id },
        data: {
          description: course.description,
          price: course.price,
        },
      });
      console.log(`🔄 Updated course   : "${updated.name}"`);
      console.log(`   ID               : ${updated.id}`);
      console.log(`   Price            : LKR ${Number(updated.price).toFixed(2)}`);
      console.log(`   Description      : ${updated.description?.slice(0, 80)}...`);
      console.log();
    } else {
      const created = await prisma.course.create({
        data: {
          name: course.name,
          description: course.description,
          price: course.price,
        },
      });
      console.log(`✅ Created course   : "${created.name}"`);
      console.log(`   ID               : ${created.id}`);
      console.log(`   Price            : LKR ${Number(created.price).toFixed(2)}`);
      console.log(`   Description      : ${created.description?.slice(0, 80)}...`);
      console.log();
    }
  }

  console.log("🏁 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
