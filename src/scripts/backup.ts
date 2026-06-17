import dotenv from 'dotenv';
dotenv.config();
import prisma from '../config/db';
import fs from 'fs';
import path from 'path';


async function backup() {
  console.log('Starting backup...');
  const backupDir = path.join(__dirname, '../../backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const models = [
    'user',
    'course',
    'enrollment',
    'exam',
    'question',
    'examAttempt',
    'answer',
    'video'
  ];

  for (const model of models) {
    console.log(`Backing up ${model}...`);
    // @ts-ignore
    const data = await prisma[model].findMany();
    fs.writeFileSync(
      path.join(backupDir, `${model}.json`),
      JSON.stringify(data, null, 2)
    );
    console.log(`Backed up ${data.length} records for ${model}.`);
  }

  console.log('Backup completed successfully.');
}

backup()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
