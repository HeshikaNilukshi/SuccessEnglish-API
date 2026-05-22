# Phase 4: Courses & Enrollments (CRUD, Payment Verification)

## Goal
Admin manages courses. Students request enrollment; admin verifies payment and approves.

---

## Part A — Course CRUD

### Step 1: Course Controller

**File:** `src/controllers/course.controller.ts`

### `createCourse` — POST `/api/courses/` (Admin only)
1. Validate body: `name` (required), `description` (optional)
2. Create course
3. Return `201` with course

### `getAllCourses` — GET `/api/courses/` (Authenticated)
1. Fetch all courses
2. Return `200` with courses array

### `getCourse` — GET `/api/courses/:id` (Authenticated)
1. Find course by ID, include related data count (enrollments, exams, materials)
2. `404` if not found
3. Return `200` with course

### `updateCourse` — PUT `/api/courses/:id` (Admin only)
1. Validate body: `name`, `description` (optional)
2. Update course → `404` if not found
3. Return `200` with updated course

### `deleteCourse` — DELETE `/api/courses/:id` (Admin only)
1. Delete course → `404` if not found
2. Return `200` with success message

---

### Step 2: Course Routes

**File:** `src/routes/course.routes.ts`

```
POST   /api/courses/       → createCourse    [auth, role("ADMIN")]
GET    /api/courses/        → getAllCourses    [auth]
GET    /api/courses/:id     → getCourse        [auth]
PUT    /api/courses/:id     → updateCourse     [auth, role("ADMIN")]
DELETE /api/courses/:id     → deleteCourse     [auth, role("ADMIN")]
```

---

## Part B — Enrollments

### Step 3: Enrollment Controller

**File:** Add enrollment methods to `src/controllers/course.controller.ts` (or create a separate file — keeping in same file is simpler)

### `requestEnrollment` — POST `/api/enrollments/` (Student only)
1. Validate body: `courseId`
2. Check course exists → `404`
3. Check if already enrolled (unique constraint) → `409 Already enrolled`
4. Create enrollment with `verified: false`
5. Return `201` with enrollment

### `getAllEnrollments` — GET `/api/enrollments/` (Admin only)
1. Fetch all enrollments, include user name/email and course name
2. Return `200`

### `getMyEnrollments` — GET `/api/enrollments/my` (Student)
1. Fetch enrollments where `userId = req.user.id`, include course details
2. Return `200`

### `verifyEnrollment` — PATCH `/api/enrollments/:id/verify` (Admin only)
1. Find enrollment → `404` if not found
2. Set `verified: true`
3. Return `200` with updated enrollment

---

### Step 4: Enrollment Routes

**File:** `src/routes/course.routes.ts` (append to same file or create `enrollment.routes.ts` — either works)

```
POST   /api/enrollments/           → requestEnrollment   [auth, role("STUDENT")]
GET    /api/enrollments/            → getAllEnrollments    [auth, role("ADMIN")]
GET    /api/enrollments/my          → getMyEnrollments    [auth, role("STUDENT")]
PATCH  /api/enrollments/:id/verify  → verifyEnrollment    [auth, role("ADMIN")]
```

---

### Step 5: Register Routes in app.ts

```typescript
import courseRoutes from './routes/course.routes';
app.use('/api/courses', courseRoutes);

// If separate file:
import enrollmentRoutes from './routes/enrollment.routes';
app.use('/api/enrollments', enrollmentRoutes);
```

---

## Verification

1. Admin creates a course → `201`
2. Student requests enrollment → `201` with `verified: false`
3. Student requests same course again → `409`
4. Admin lists all enrollments → sees pending enrollments
5. Admin verifies enrollment → `verified: true`
6. Student lists own enrollments → sees verified status
7. Non-admin tries to create/delete course → `403`
