# Phase 1: Prisma Schema, DB Connection & Cloudinary Helper

## Goal
Set up the database schema, Prisma client singleton configured for Prisma v7 with Neon DB serverless driver adapter, and the Cloudinary upload utility.

---

## Step 1: Create/Update Prisma Schema

**File:** `prisma/schema.prisma`

Configure the generator to use `prisma-client` and output the generated client to `../src/generated/prisma`. Remove the `url` parameter from the `datasource` block since database connections in Prisma v7 are managed in `prisma.config.ts`.

Replace the content of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  ADMIN
  TEACHER
  STUDENT
}

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  role      Role     @default(STUDENT)
  createdAt DateTime @default(now())

  // Relations
  enrollments    Enrollment[]
  examAttempts   ExamAttempt[]
  createdExams   Exam[]           @relation("ExamCreator")
  uploadedMaterials CourseMaterial[] @relation("MaterialUploader")
}

model Course {
  id        String   @id @default(uuid())
  name      String
  description String?
  createdAt DateTime @default(now())

  enrollments Enrollment[]
  exams       Exam[]
  materials   CourseMaterial[]
}

model Enrollment {
  id         String   @id @default(uuid())
  userId     String
  courseId    String
  verified   Boolean  @default(false)
  createdAt  DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId])
}

model Exam {
  id        String   @id @default(uuid())
  title     String
  courseId   String
  createdBy String
  createdAt DateTime @default(now())

  course    Course    @relation(fields: [courseId], references: [id])
  creator   User      @relation("ExamCreator", fields: [createdBy], references: [id])
  questions Question[]
  attempts  ExamAttempt[]
}

model Question {
  id            String @id @default(uuid())
  examId        String
  questionText  String
  correctAnswer String
  marks         Int

  exam    Exam     @relation(fields: [examId], references: [id], onDelete: Cascade)
  answers Answer[]
}

model ExamAttempt {
  id        String   @id @default(uuid())
  examId    String
  studentId String
  score     Int?
  createdAt DateTime @default(now())

  exam    Exam    @relation(fields: [examId], references: [id])
  student User    @relation(fields: [studentId], references: [id])
  answers Answer[]

  @@unique([examId, studentId])
}

model Answer {
  id            String @id @default(uuid())
  attemptId     String
  questionId    String
  studentAnswer String

  attempt  ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question Question    @relation(fields: [questionId], references: [id])
}

model CourseMaterial {
  id         String   @id @default(uuid())
  courseId    String
  uploadedBy String
  title      String
  fileUrl    String
  publicId   String
  fileType   String
  createdAt  DateTime @default(now())

  course   Course @relation(fields: [courseId], references: [id])
  uploader User   @relation("MaterialUploader", fields: [uploadedBy], references: [id])
}
```

---

## Step 2: Push Schema and Generate Client

Prisma v7 requires explicit execution of the generate step after push:

```bash
npx prisma db push
npx prisma generate
```

---

## Step 3: Prisma Client Singleton (Prisma v7 + Neon Serverless Adapter)

**File:** `src/config/db.ts`

Initialize the Prisma client using `@prisma/adapter-neon` and `@neondatabase/serverless` with WebSocket support:

```typescript
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client';
import ws from 'ws';

// Configure WebSockets for Node.js environment
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured in .env file");
}

// In Prisma v7, PrismaNeon takes the PoolConfig directly and manages the pool internally
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

export default prisma;
```

---

## Step 4: Cloudinary Config & Upload Helper

**File:** `src/utils/cloudinary.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload buffer to Cloudinary
export const uploadToCloudinary = (
  fileBuffer: Buffer,
  folder: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// Delete from Cloudinary
export const deleteFromCloudinary = (publicId: string): Promise<any> => {
  return cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
```

---

## Step 5: Update app.ts

**File:** `src/app.ts`

Remove the boilerplate routes (index, users) and set up the base API structure:

```typescript
import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

---

## Step 6: Clean up server.ts

**File:** `src/server.ts`

```typescript
import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Step 7: Delete Boilerplate Files

Delete the scaffolded boilerplate routes that are no longer needed:
- `src/routes/index.ts`
- `src/routes/users.ts`

---

## Verification

1. Run `npx prisma db push` — should succeed without errors and sync to Neon DB.
2. Run `npx prisma generate` — should generate client inside `src/generated/prisma`.
3. Start dev server: `npm run dev`.
4. Verify the server is running by hitting `http://localhost:5000/api/health`.
