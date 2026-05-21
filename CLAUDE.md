# Class Manager – Project Context

App quản lý lớp học online cho giáo viên dạy theo nhóm nhỏ (vợ tôi dạy tiếng Trung HSK).

## 🏗️ Stack

- **Backend**: NestJS 10 + TypeORM + PostgreSQL + JWT auth + Multer (file upload)
- **Frontend**: Vue 3 (Composition API) + Vite + Element Plus + Pinia + ECharts + dayjs
- **Database**: PostgreSQL với 16 bảng

## 📂 Cấu trúc

```
class-manager/
├── database/schema.sql      ← PostgreSQL schema + seed data
├── backend/                  ← NestJS API ở http://localhost:3000/api
│   ├── uploads/              ← Folder file user upload (served tại /uploads/)
│   └── src/
│       ├── main.ts           ← Bootstrap + static file serve cho uploads
│       ├── app.module.ts
│       ├── common/           ← RolesGuard, CurrentUser decorator
│       └── modules/          ← 15 modules
└── frontend/                 ← Vue SPA ở http://localhost:5173
    └── src/
        ├── api/index.js      ← Tất cả endpoint API (axios)
        ├── stores/           ← Pinia (auth, class)
        ├── router/           ← Vue Router với role guard
        ├── utils/format.js   ← Helper formatters
        └── views/
            ├── auth/Login.vue
            ├── AppLayout.vue       ← Sidebar layout với dropdown user
            ├── teacher/      ← Dashboard, Attendance, Grades, Assignments, Progress, Analytics
            ├── student/      ← StudentDashboard, StudentGrades, StudentAssignments, StudentAttendance
            ├── admin/        ← AdminDashboard, Users, Courses
            └── shared/       ← Classes, Materials, Calendar, Payments, Notifications, Profile
```

## 🔧 Quy ước code

### Backend
- **Mỗi module gộp service + controller + entity vào 1 file** `<module>.module.ts`
- Auth bằng JWT, decorator `@Roles('TEACHER','ADMIN')` từ `common/roles.guard.ts`
- Get current user: `@CurrentUser() user: any` từ `common/current-user.decorator.ts`
- JWT strategy inject `ConfigService` (KHÔNG dùng trực tiếp `process.env`)
- DTO bỏ qua, dùng `@Body() body: any` cho gọn
- File upload: Multer disk storage → `backend/uploads/<filename>`, expose qua `/uploads/<filename>`
- Routes có prefix `/api/` trừ `/uploads/...` (đã exclude trong `main.ts`)
- AI gợi ý nhận xét dùng module `ai-suggestions`: `POST /api/ai/suggest-feedback`, yêu cầu `ANTHROPIC_API_KEY` và chỉ generate khi giáo viên bấm nút.

### Frontend
- Vue 3 Composition API với `<script setup>`
- Element Plus cho UI
- Icons từ `@element-plus/icons-vue`
- API gọi qua `src/api/index.js` (axios với JWT interceptor)
- PWA dùng `vite-plugin-pwa`, manifest/icon ở `frontend/public`, layout mobile có hamburger sidebar trong `AppLayout.vue`
- Batch UX: Calendar có timetable tuần + export `.ics`; Grades/Attendance/Assignments/Classes có search/filter cơ bản; Grades và Classes có print-friendly mode; Grades có sticker feedback nhanh.
- Batch analytics: module `analytics` cung cấp compare classes, ranking, predict final, attendance heatmap, assignment difficulty; `reports/student-final/:studentId` sinh PDF báo cáo cuối khóa.
- Format helpers ở `src/utils/format.js`: `fmtMoney`, `fmtDate`, `fmtDateTime`, `gradeClassify`, `submissionBadge`, `attendanceBadge`, `paymentBadge`, `initials`
- Badge classes: `.badge-green` (success), `.badge-red` (danger), `.badge-amber` (warning), `.badge-blue` (info), `.badge-gray` (neutral), `.badge-purple`
- Primary color: `#1D9E75` (dark `#0F6E56`, light `#E1F5EE`)
- Theme background: `#F5F4F0` cho main content, `#fff` cho cards

## 🗄️ Database

- 16 bảng. Foreign keys + cascade đầy đủ
- **Field naming**: snake_case trong DB, camelCase trong TypeScript (TypeORM `@Column({ name: 'snake_name' })`)
- Raw SQL query trong service dùng `dataSource.query(sql, params)` với `$1, $2...` placeholders
- Seed data: 8 users, 2 courses, 2 classes, 10 sessions, 4 grade items, 3 assignments, 5 payments

## 🔐 Auth flow

- Login → trả `accessToken` (JWT) + `user`
- Frontend lưu token vào `localStorage` + Pinia store
- Axios interceptor tự thêm header `Authorization: Bearer <token>`
- Token expire 7 ngày, route guard tự redirect về `/login` khi 401
- 3 roles: `ADMIN`, `TEACHER`, `STUDENT`
- Endpoint `/auth/change-password` đổi password
- API tự filter theo role (vd classes: TEACHER thấy lớp mình dạy, STUDENT thấy lớp mình học)

## 🚀 Run

```powershell
# Backend (terminal 1)
cd backend && npm run start:dev      # http://localhost:3000/api

# Frontend (terminal 2)
cd frontend && npm run dev            # http://localhost:5173

# Database query
psql -U postgres -d class_manager
```

**Tài khoản test** (password: `password123`):
- `admin@cm.com` (Admin)
- `teacher@cm.com` (Giáo viên - chính)
- `student1@cm.com` → `student5@cm.com` (Học viên)

## 📋 Roadmap tính năng

### ✅ Đã làm xong (Phase 1 MVP + Patch v2)
- Auth JWT + 3 roles + đổi password + profile cá nhân
- Quản lý lớp, khóa học (CRUD đầy đủ)
- Quản lý người dùng (admin)
- Thêm/xóa học viên vào lớp (bulk + tạo HV mới + auto enroll)
- Tự động tạo payment khi enroll
- Điểm danh: tạo/sửa/xóa session, bulk mark, "all present/absent", lý do vắng
- Quản lý điểm: cột điểm + hệ số + nhận xét, tự tính TB + xếp loại
- Bài tập: tạo/sửa/xóa, upload nộp bài, xem file đã nộp (preview ảnh), chấm + feedback + revision
- Tiến độ khóa, Tài liệu, Lịch học, Báo cáo (ECharts)
- Học phí (PAID/PENDING/PARTIAL)
- Thông báo + alert rules (cron 8h sáng)
- Export CSV bảng điểm + điểm danh

### 🔜 Phase A – Nâng cấp đáng kể (chưa làm)
- [x] Link Zoom/Google Meet cho mỗi session (field `meeting_url`)
- [x] Reminder tự động trước buổi học 1h (DB notification)
- [x] Hóa đơn PDF + Báo cáo doanh thu theo tháng
- [x] Tự sinh lịch học khi tạo lớp (T2-T4-T6, 19h-21h → 24 buổi)
- [x] Quên mật khẩu / reset qua email

### 🔮 Phase B – Tăng giá trị
- [x] Forum/Bảng tin trong lớp (post + comment realtime Socket.IO)
- [x] Quiz online tự chấm
- [x] Certificate PDF cuối khóa
- [ ] Học viên feedback ẩn danh

### 🌟 Phase C – Nice-to-have
- [x] Dark mode, i18n (VI/EN/ZH), Upload avatar
- [x] Mobile PWA
- [x] AI gợi ý nhận xét (dùng Claude API)
- [x] Timetable tuần + export `.ics`, search/filter/sort cơ bản, print bảng điểm/danh sách lớp, sticker feedback nhanh
- [x] Báo cáo PDF cuối khóa, ranking, heatmap chuyên cần, phân tích bài tập khó, so sánh lớp, dự đoán điểm cuối kỳ
- [ ] Drag & drop sắp xếp cột điểm/session

## ⚠️ Gotchas đã gặp

- **PowerShell ăn ký tự `$` trong bcrypt hash** → dùng file SQL hoặc node script
- **UTF-8 encoding psql**: set `$env:PGCLIENTENCODING = "UTF8"` trước khi chạy psql
- **JWT cần ConfigService**: passport strategy phải inject `ConfigService`, không dùng `process.env` trực tiếp
- **NestJS 10**: cài package phụ phải đúng version (vd `@nestjs/serve-static@4`)
- **Static file 404**: `main.ts` phải có `useStaticAssets(uploadDir, { prefix: '/uploads/' })` + `exclude: ['uploads/(.*)']` trong setGlobalPrefix
- **Foreign keys cascade**: xóa course → kéo theo classes → enrollments/sessions/grades...

## 💬 Cách làm việc với Claude Code

Khi thêm tính năng mới, thường cần edit nhiều file:
- **Backend**: module mới (entity + service + controller trong 1 file `.module.ts`) + register trong `app.module.ts`
- **Frontend**: view mới + thêm vào `api/index.js` + thêm route + thêm menu trong `AppLayout.vue`
- **DB**: update `schema.sql` + entity TypeORM + ALTER TABLE thủ công (TypeORM `synchronize: false`)

Test API: PowerShell `Invoke-RestMethod` (xem `backend/README.md`)

Commit Git mỗi feature riêng để dễ rollback: `git commit -m "feat: thêm Zoom link cho sessions"`

Sau khi xong feature lớn, prompt Claude Code: "update CLAUDE.md, tick item đã làm trong Roadmap"
