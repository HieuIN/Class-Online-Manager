# Class Manager – Project Context

App quản lý lớp học online cho giáo viên dạy theo nhóm nhỏ (vợ tôi dạy tiếng Trung HSK).

## 🏗️ Stack

- **Backend**: NestJS 10 + TypeORM + PostgreSQL + JWT auth
- **Frontend**: Vue 3 (Composition API) + Vite + Element Plus + Pinia + ECharts
- **Database**: PostgreSQL với 15 bảng

## 📂 Cấu trúc

```
class-manager/
├── database/schema.sql      ← PostgreSQL schema + seed
├── backend/                  ← NestJS API ở http://localhost:3000/api
│   └── src/modules/          ← 15 modules: auth, users, courses, classes,
│                                enrollments, sessions, attendance,
│                                grade-items, grades, assignments,
│                                submissions, materials, payments,
│                                notifications, calendar
└── frontend/                 ← Vue SPA ở http://localhost:5173
    └── src/
        ├── api/index.js      ← Tất cả endpoint API
        ├── stores/           ← Pinia (auth, class)
        ├── router/           ← Vue Router với role guard
        └── views/
            ├── auth/         ← Login
            ├── teacher/      ← 6 views: Dashboard, Attendance, Grades, ...
            ├── student/      ← 4 views
            ├── admin/        ← 3 views: Dashboard, Users, Courses
            └── shared/       ← Classes, Materials, Calendar, Payments, ...
```

## 🔧 Quy ước code

### Backend
- Mỗi module gộp service + controller + entity vào 1 file `<module>.module.ts` (gọn, dễ hiểu)
- Auth bằng JWT, decorator `@Roles('TEACHER','ADMIN')` từ `common/roles.guard.ts`
- DTO bỏ qua, dùng `@Body() body: any` cho gọn (project nhỏ)
- Validation: dùng class-validator nếu cần, bỏ qua ở MVP
- Lưu file upload vào `backend/uploads/`, expose qua `/uploads/<filename>`

### Frontend
- Vue 3 Composition API với `<script setup>`
- Element Plus cho UI (el-button, el-table, el-dialog, el-card...)
- Pinia store ở `src/stores/`
- API gọi qua `src/api/index.js` (axios + JWT interceptor)
- Format helper ở `src/utils/format.js`
- Class màu/badge: `.badge-green`, `.badge-red`, `.badge-amber`, `.badge-blue`, `.badge-gray`, `.badge-purple`
- Primary color: `#1D9E75`, theme background `#F5F4F0`

## 🗄️ Database

- 15 bảng chính. Foreign keys + cascade đầy đủ.
- Field naming: snake_case trong DB, camelCase trong TypeScript/Vue (TypeORM dùng `@Column({ name: 'snake_name' })`)
- Seed data có sẵn:
  - 8 users (1 admin, 2 teacher, 5 student) – password tất cả: `password123`
  - 2 courses: HSK3, IELTS
  - 2 classes
  - 10 sessions, 7 đã DONE, 3 PLANNED
  - Attendance, grades, assignments, payments đầy đủ

## 🚀 Run

```bash
# Backend
cd backend && npm run start:dev      # http://localhost:3000/api

# Frontend
cd frontend && npm run dev            # http://localhost:5173

# Database (đã setup)
psql -U postgres -d class_manager
```

Tài khoản test:
- `admin@cm.com` / `password123`
- `teacher@cm.com` / `password123`
- `student1@cm.com` / `password123`

## 📋 Roadmap tính năng đang plan

(Update khi triển khai)

### Phase A – Nâng cấp đáng kể
- [ ] Link Zoom cho mỗi session
- [ ] Reminder tự động (email/Telegram trước buổi học 1h)
- [ ] Hóa đơn PDF + Báo cáo doanh thu
- [ ] Tự sinh lịch học khi tạo lớp (T2-T4-T6 19h-21h → tự tạo 24 buổi)

### Phase B – Tăng giá trị
- [ ] Forum/Chat trong lớp (Socket.IO)
- [ ] Quiz online tự chấm
- [ ] Certificate PDF cuối khóa

### Phase C – Nice-to-have
- [ ] Dark mode
- [ ] i18n (EN/VN)
- [ ] Upload avatar
- [ ] Mobile PWA

## ⚠️ Gotchas đã gặp

- **PowerShell ăn ký tự `$` trong bcrypt hash** → dùng SQL file, không paste hash vào command line
- **UTF-8 encoding**: set `$env:PGCLIENTENCODING = "UTF8"` khi chạy psql
- **JWT cần ConfigService**: passport strategy phải inject `ConfigService`, không dùng trực tiếp `process.env`
- **CORS**: backend đã cho `http://localhost:5173`, đổi trong `backend/.env` nếu cần

## 💬 Cách làm việc với Claude Code

- Khi thêm tính năng mới: edit cả backend (module mới) + frontend (view + api/index.js + router + sidebar nav trong AppLayout.vue)
- Khi thêm field DB mới: update `database/schema.sql` + entity TypeORM + migration tay (`ALTER TABLE...`)
- Test API: dùng PowerShell `Invoke-RestMethod` (xem README backend cho ví dụ)
- Mỗi feature nên có 1 commit riêng cho dễ rollback
