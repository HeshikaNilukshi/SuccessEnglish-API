import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import prisma from '../config/db';

const teacher = {
  name: 'David Jones',
  email: 'dave@gmail.com',
  password: '652423'
};

async function seed() {
  console.log('🌱 Seeding teacher...\n');

  const hashedPassword = await bcrypt.hash(teacher.password, 10);

  const result = await prisma.user.upsert({
    where: { email: teacher.email },
    update: {
      role: 'TEACHER',
      name: teacher.name,
      password: hashedPassword,
    },
    create: {
      name: teacher.name,
      email: teacher.email,
      password: hashedPassword,
      role: 'TEACHER',
    },
  });

  console.log(`  Name: ${result.name}`);
  console.log(`  Email: ${result.email}`);
  console.log(`  Role: ${result.role}`);
  console.log('\n🎉 Teacher account seeded successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
