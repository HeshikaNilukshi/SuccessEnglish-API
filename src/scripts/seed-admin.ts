import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import prisma from '../config/db';

const admin = {
  name: 'Admin',
  email: 'admin@gmail.com',
  password: '652423'
};

async function seed() {
  console.log('🌱 Seeding admin...\n');

  const hashedPassword = await bcrypt.hash(admin.password, 10);

  const result = await prisma.user.upsert({
    where: { email: admin.email },
    update: {
      role: 'ADMIN',
      name: admin.name,
      password: hashedPassword,
    },
    create: {
      name: admin.name,
      email: admin.email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log(`  Name: ${result.name}`);
  console.log(`  Email: ${result.email}`);
  console.log(`  Role: ${result.role}`);
  console.log('\n🎉 Admin account seeded successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
