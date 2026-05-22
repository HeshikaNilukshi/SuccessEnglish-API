# Phase 6: Course Materials (Upload, Download, Update, Delete via Cloudinary)

## Goal
Admin and Teacher can upload/update/delete course materials (files & videos) via Cloudinary. Enrolled students can view and download materials for their courses.

---

## Step 1: Multer Memory Storage Config

**File:** `src/utils/cloudinary.ts` (append to existing file)

Add a Multer config using memory storage (no local disk):

```typescript
import multer from 'multer';

const storage = multer.memoryStorage();
export const upload = multer({ storage });
```

---

## Step 2: Material Controller

**File:** `src/controllers/material.controller.ts`

### `uploadMaterial` — POST `/api/materials/` (Admin, Teacher)
1. Use `upload.single('file')` middleware before this handler
2. Validate body: `courseId`, `title`, `fileType` ("video" | "document")
3. Check course exists → `404`
4. Upload `req.file.buffer` to Cloudinary using `uploadToCloudinary(buffer, "lms_materials")`
5. Save to DB: `fileUrl` = Cloudinary secure_url, `publicId` = Cloudinary public_id
6. Return `201` with material record

### `getMaterialsByCourse` — GET `/api/materials/course/:courseId` (Admin, Teacher, Enrolled Student)
1. If student: check they have a **verified** enrollment for this course → `403` if not
2. If admin/teacher: allow access directly
3. Fetch all materials for the course
4. Return `200`

### `downloadMaterial` — GET `/api/materials/:id/download` (Admin, Teacher, Enrolled Student)
1. Find material → `404`
2. If student: check verified enrollment for the material's course → `403`
3. Redirect to the Cloudinary URL (`res.redirect(material.fileUrl)`)

### `updateMaterial` — PUT `/api/materials/:id` (Admin, Teacher)
1. Find material → `404`
2. If new file is uploaded (`req.file` exists):
   - Delete old file from Cloudinary using `deleteFromCloudinary(material.publicId)`
   - Upload new file, get new URL and publicId
3. Update DB record with new `title`, `fileUrl`, `publicId` as applicable
4. Return `200` with updated material

### `deleteMaterial` — DELETE `/api/materials/:id` (Admin, Teacher)
1. Find material → `404`
2. Delete from Cloudinary using `deleteFromCloudinary(material.publicId)`
3. Delete from DB
4. Return `200` with success message

---

## Step 3: Material Routes

**File:** `src/routes/material.routes.ts`

```
POST   /api/materials/                → [auth, role("ADMIN","TEACHER"), upload.single('file')] → uploadMaterial
GET    /api/materials/course/:courseId → [auth] → getMaterialsByCourse
GET    /api/materials/:id/download    → [auth] → downloadMaterial
PUT    /api/materials/:id             → [auth, role("ADMIN","TEACHER"), upload.single('file')] → updateMaterial
DELETE /api/materials/:id             → [auth, role("ADMIN","TEACHER")] → deleteMaterial
```

---

## Step 4: Register Routes in app.ts

```typescript
import materialRoutes from './routes/material.routes';
app.use('/api/materials', materialRoutes);
```

---

## Verification

1. Teacher uploads a file → `201`, check Cloudinary URL works
2. Teacher uploads a video → `201`, Cloudinary handles resource_type auto
3. Enrolled (verified) student lists course materials → sees all materials
4. Non-enrolled student tries to access → `403`
5. Teacher updates material with new file → old file deleted from Cloudinary
6. Teacher deletes material → removed from DB and Cloudinary
7. Student tries to upload/delete → `403`
