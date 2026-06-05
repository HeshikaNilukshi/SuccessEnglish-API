import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import prisma from '../config/db';


const students = [
  { name: 'Amal Perera',      email: 'amal.perera@gmail.com',     password: 'Amal@2024'    },
  { name: 'Nimali Fernando',  email: 'nimali.fernando@gmail.com', password: 'Nima@2024'    },
  { name: 'Kasun Silva',      email: 'kasun.silva@gmail.com',     password: 'Kasu@2024'    },
  { name: 'Dilani Jayawardena', email: 'dilani.jaya@gmail.com',   password: 'Dila@2024'    },
  { name: 'Chamara Bandara',  email: 'chamara.bandara@gmail.com', password: 'Cham@2024'    },
  { name: 'Sachini Rajapaksa',email: 'sachini.raja@gmail.com',    password: 'Sach@2024'    },
  { name: 'Nuwan Dissanayake',email: 'nuwan.dissa@gmail.com',     password: 'Nuwa@2024'    },
  { name: 'Tharushi Wickramasinghe', email: 'tharushi.wick@gmail.com', password: 'Thar@2024' },
  { name: 'Malith Gunasekara',email: 'malith.guna@gmail.com',     password: 'Mali@2024'    },
  { name: 'Sanduni Madushani',email: 'sanduni.madu@gmail.com',    password: 'Sand@2024'    },
  { name: 'Ravindu Senanayake',email: 'ravindu.sena@gmail.com',   password: 'Ravi@2024'    },
  { name: 'Savindu Perera',   email: 'savi@gmail.com',            password: '652423'       },
];

async function seed() {
  console.log('🌱 Seeding 12 students...\n');

  for (const student of students) {
    const hashedPassword = await bcrypt.hash(student.password, 10);

    await prisma.user.upsert({
      where: { email: student.email },
      update: {},  // do nothing if already exists
      create: {
        name: student.name,
        email: student.email,
        password: hashedPassword,
        role: 'STUDENT',
      },
    });

    console.log(`  ✅ ${student.name} (${student.email})`);
  }

  console.log('\n🎉 All 12 students seeded successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
