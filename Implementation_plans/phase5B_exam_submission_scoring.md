# Phase 5B: Exam Submission, Auto-Scoring & Results

## Goal
Students submit exam answers and get auto-scored. Teachers/Admin can view all results.

---

## Step 1: Submission & Results (Add to Exam Controller)

**File:** `src/controllers/exam.controller.ts` (append to existing)

### `submitExam` — POST `/api/exams/:id/submit` (Student only)
1. Validate body: `answers` array with `[{ questionId, studentAnswer }]`
2. Check exam exists, include questions → `404`
3. Check student hasn't already attempted → `409 Already attempted`
4. Auto-score: compare each `studentAnswer` to `correctAnswer` (case-insensitive, trimmed). Sum marks for matches.
5. Create ExamAttempt with nested answers in one Prisma create
6. Return `201` with `{ attemptId, score, totalMarks }`

### `getExamResults` — GET `/api/exams/:id/results` (Admin, Teacher)
1. Find all attempts for this exam, include student name/email and score
2. Return `200` with results array

### `getMyResult` — GET `/api/exams/:id/my-result` (Student)
1. Find attempt where `examId = :id` AND `studentId = req.user.id`
2. Include answers with question text → `404` if not found
3. Return `200` with attempt details

---

## Step 2: Add Routes to exam.routes.ts

```
POST /api/exams/:id/submit     → submitExam      [auth, role("STUDENT")]
GET  /api/exams/:id/results    → getExamResults   [auth, role("ADMIN", "TEACHER")]
GET  /api/exams/:id/my-result  → getMyResult      [auth, role("STUDENT")]
```

---

## Verification

1. Student submits answers → `201` with auto-calculated score
2. Student submits same exam again → `409`
3. Case-insensitive: "paris" matches "Paris" → correct
4. Teacher views results → sees all student scores
5. Student views own result → sees score + answers
