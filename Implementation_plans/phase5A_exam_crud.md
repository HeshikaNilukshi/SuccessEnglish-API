# Phase 5A: Exam CRUD (Create, Read, Update, Delete with Questions)

## Goal
Admin and Teacher can create, update, and delete exams. Each exam contains questions with correct answers and marks.

---

## Step 1: Exam Controller (CRUD)

**File:** `src/controllers/exam.controller.ts`

### `createExam` — POST `/api/exams/` (Admin, Teacher)
1. Validate body:
   ```json
   {
     "title": "Midterm Exam",
     "courseId": "uuid",
     "questions": [
       { "questionText": "What is 2+2?", "correctAnswer": "4", "marks": 5 },
       { "questionText": "Capital of France?", "correctAnswer": "Paris", "marks": 10 }
     ]
   }
   ```
2. Check course exists → `404`
3. Create exam with nested `questions` using Prisma's `create` with nested `create`:
   ```typescript
   prisma.exam.create({
     data: {
       title, courseId, createdBy: req.user.id,
       questions: { create: questions }
     },
     include: { questions: true }
   });
   ```
4. Return `201` with exam + questions

### `getExamsByCourse` — GET `/api/exams/course/:courseId` (Authenticated)
1. Fetch all exams for the course
2. Include question count (but NOT correct answers for students)
3. Return `200`

### `getExam` — GET `/api/exams/:id` (Authenticated)
1. Find exam by ID, include questions
2. **If student:** Strip `correctAnswer` from each question before returning
3. **If admin/teacher:** Include `correctAnswer`
4. Return `200` (or `404`)

### `updateExam` — PUT `/api/exams/:id` (Admin, Teacher)
1. Validate body: `title` (optional), `questions` (optional — full replacement array)
2. Find exam → `404`
3. If questions provided:
   - Delete all existing questions for this exam
   - Create new questions
4. Update exam title if provided
5. Use a Prisma transaction for atomicity:
   ```typescript
   prisma.$transaction([
     prisma.question.deleteMany({ where: { examId } }),
     prisma.exam.update({ ... })
   ]);
   ```
6. Return `200` with updated exam + questions

### `deleteExam` — DELETE `/api/exams/:id` (Admin, Teacher)
1. Find exam → `404`
2. Delete exam (questions cascade-delete via `onDelete: Cascade`)
3. Return `200` with success message

---

## Step 2: Exam Routes

**File:** `src/routes/exam.routes.ts`

```
POST   /api/exams/                → createExam          [auth, role("ADMIN", "TEACHER")]
GET    /api/exams/course/:courseId → getExamsByCourse     [auth]
GET    /api/exams/:id              → getExam              [auth]
PUT    /api/exams/:id              → updateExam           [auth, role("ADMIN", "TEACHER")]
DELETE /api/exams/:id              → deleteExam           [auth, role("ADMIN", "TEACHER")]
```

---

## Step 3: Register Routes in app.ts

```typescript
import examRoutes from './routes/exam.routes';
app.use('/api/exams', examRoutes);
```

---

## Verification

1. Teacher creates exam with 3 questions → `201` with questions included
2. Admin creates exam → `201` (admin inherits teacher permissions)
3. `GET /api/exams/:id` as teacher → shows correctAnswer
4. `GET /api/exams/:id` as student → correctAnswer is stripped
5. Teacher updates exam with new questions → old questions deleted, new ones created
6. Teacher deletes exam → questions cascade-deleted
7. Student tries to create/update/delete → `403`
