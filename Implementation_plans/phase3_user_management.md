# Phase 3: User Management (CRUD, Role-Based Access)

## Goal
Admin can create/update/delete any user (including Admin & Teacher accounts). All authenticated users can view and update their own profile.

---

## Step 1: User Controller

**File:** `src/controllers/user.controller.ts`

### `createUser` — POST `/api/users/` (Admin only)
1. Validate body: `name`, `email`, `password`, `role` (must be ADMIN, TEACHER, or STUDENT)
2. Check if email exists → `409 Conflict`
3. Hash password with bcrypt
4. Create user with specified role
5. Return `201` with user (exclude password)

### `getAllUsers` — GET `/api/users/` (Admin only)
1. Fetch all users from DB
2. Return `200` with users array (exclude passwords)

### `getMe` — GET `/api/users/me` (Authenticated)
1. Get user by `req.user.id`
2. Return `200` with user data (exclude password)

### `updateMe` — PUT `/api/users/me` (Authenticated)
1. Validate body: `name`, `email` (optional fields)
2. If password is being updated, hash it
3. Update user by `req.user.id`
4. Return `200` with updated user (exclude password)
5. Do NOT allow changing own role

### `updateUser` — PUT `/api/users/:id` (Admin only)
1. Validate body: `name`, `email`, `role` (all optional)
2. If password provided, hash it
3. Update user by `req.params.id`
4. Return `200` with updated user

### `deleteUser` — DELETE `/api/users/:id` (Admin only)
1. Check user exists → `404` if not
2. Delete user
3. Return `200` with success message

---

## Step 2: User Routes

**File:** `src/routes/user.routes.ts`

```
POST   /api/users/       → createUser     [auth, role("ADMIN")]
GET    /api/users/        → getAllUsers     [auth, role("ADMIN")]
GET    /api/users/me      → getMe          [auth]
PUT    /api/users/me      → updateMe       [auth]
PUT    /api/users/:id     → updateUser     [auth, role("ADMIN")]
DELETE /api/users/:id     → deleteUser     [auth, role("ADMIN")]
```

**Important:** Place `/me` routes BEFORE `/:id` routes so Express doesn't treat "me" as an ID parameter.

---

## Step 3: Register Routes in app.ts

```typescript
import userRoutes from './routes/user.routes';
app.use('/api/users', userRoutes);
```

---

## Verification

1. Login as admin → `POST /api/users/` with role TEACHER → creates teacher account
2. Login as teacher → `POST /api/users/` → 403 Forbidden
3. Any authenticated user → `GET /api/users/me` → returns own profile
4. Any authenticated user → `PUT /api/users/me` → updates name/email/password
5. Admin → `PUT /api/users/:id` → can change any user's role
6. Admin → `DELETE /api/users/:id` → deletes user
7. Non-admin → `DELETE /api/users/:id` → 403

> **Note:** You will need to manually create the first admin account. Use `npx prisma studio` or seed the DB. Consider adding a simple seed script in Phase 1's Prisma setup or manually insert via Prisma Studio.
