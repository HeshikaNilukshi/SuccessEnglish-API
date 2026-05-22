# Phase 2: Authentication (Register, Login, JWT Middleware, Role Guard)

## Goal
Implement public registration (student self-register), login, JWT-based auth middleware, and role-based access guard.

---

## Step 1: Auth Middleware (JWT Verification)

**File:** `src/middleware/auth.ts`

- Extract `Authorization: Bearer <token>` from request header
- Verify token using `jsonwebtoken` and `JWT_SECRET`
- Decode payload (`{ id, role }`) and attach to `req.user`
- If invalid/missing token → `401 Unauthorized`

**Extend Express Request type** to include `user`:

```typescript
// Declare in auth.ts or a separate types file
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
```

---

## Step 2: Role Guard Middleware

**File:** `src/middleware/role.ts`

- Takes an array of allowed roles: `role("ADMIN", "TEACHER")`
- Returns middleware that checks `req.user.role` against the allowed list
- If not allowed → `403 Forbidden`
- Must be used AFTER `auth` middleware in the route chain

---

## Step 3: Auth Controller

**File:** `src/controllers/auth.controller.ts`

### `register` — POST `/api/auth/register`
1. Validate body: `name`, `email`, `password` (use express-validator)
2. Check if email already exists → `409 Conflict`
3. Hash password with `bcrypt` (10 salt rounds)
4. Create user with `role: "STUDENT"` (only students can self-register)
5. Generate JWT with `{ id, role }` payload, sign with `JWT_SECRET`
6. Return `201` with `{ token, user: { id, name, email, role } }`

### `login` — POST `/api/auth/login`
1. Validate body: `email`, `password`
2. Find user by email → `401 Invalid credentials` if not found
3. Compare password with bcrypt → `401` if mismatch
4. Generate JWT token
5. Return `200` with `{ token, user: { id, name, email, role } }`

---

## Step 4: Auth Routes

**File:** `src/routes/auth.routes.ts`

```
POST /api/auth/register  → auth.controller.register  (Public)
POST /api/auth/login     → auth.controller.login      (Public)
```

No middleware needed — both are public endpoints.

---

## Step 5: Register Routes in app.ts

**File:** `src/app.ts`

Import and mount:
```typescript
import authRoutes from './routes/auth.routes';
app.use('/api/auth', authRoutes);
```

---

## Verification

1. `POST /api/auth/register` with `{ name, email, password }` → returns token + user with role STUDENT
2. `POST /api/auth/register` with same email → returns 409
3. `POST /api/auth/login` with correct creds → returns token
4. `POST /api/auth/login` with wrong password → returns 401
5. Use returned token in `Authorization: Bearer <token>` header for future requests
