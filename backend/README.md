# Class Manager Backend (NestJS + TypeORM + PostgreSQL)

REST API cho ứng dụng quản lý lớp học online.

## Cài đặt

```bash
cd backend
npm install
cp .env.example .env  # sửa thông tin DB
```

## Tạo database

```bash
createdb class_manager      # PostgreSQL phải đang chạy
psql class_manager < ../database/schema.sql
```

## Chạy

```bash
npm run start:dev    # development mode (watch)
npm run start:prod   # production
```

API sẽ chạy ở `http://localhost:3000/api`

## Tài khoản mẫu (tất cả password: `password123`)

- Admin: `admin@cm.com`
- Giáo viên: `teacher@cm.com` / `teacher2@cm.com`
- Học viên: `student1@cm.com` → `student5@cm.com`

## API Endpoints

### Auth
- `POST /api/auth/login` – `{email, password}`
- `POST /api/auth/register` – `{email, password, fullName, phone?, role?}`
- `GET /api/auth/me` – thông tin user hiện tại (cần JWT)

### Users (Admin)
- `GET /api/users?role=STUDENT`
- `POST /api/users` – tạo user
- `PATCH /api/users/:id`

### Courses, Classes
- `GET /api/courses`
- `GET /api/classes` – tự động filter theo role
- `GET /api/classes/:id/students`
- `POST /api/classes` – tạo lớp (teacher/admin)

### Enrollments
- `POST /api/enrollments` – `{classId, studentId}`
- `POST /api/enrollments/bulk` – `{classId, studentIds: []}`

### Sessions (Buổi học)
- `GET /api/sessions?classId=1`
- `GET /api/sessions/progress/:classId`
- `POST /api/sessions` – `{classId, sessionNo, plannedDate, topic}`
- `PATCH /api/sessions/:id` – `{status: 'DONE', actualDate}`

### Attendance (Điểm danh)
- `GET /api/attendance?sessionId=1`
- `GET /api/attendance/matrix/:classId`
- `GET /api/attendance/stats?studentId=4&classId=1`
- `POST /api/attendance/bulk` – `{sessionId, records: [{studentId, status, isExcused?}]}`

### Grade Items + Grades
- `GET /api/grade-items?classId=1`
- `POST /api/grade-items` – `{classId, name, weight, maxScore}`
- `GET /api/grades?studentId=4&classId=1`
- `GET /api/grades/average?studentId=4&classId=1`
- `GET /api/grades/distribution/:classId?itemName=Giữa kỳ`
- `POST /api/grades` – `{gradeItemId, studentId, score, feedback}`
- `POST /api/grades/bulk` – import Excel

### Assignments + Submissions
- `GET /api/assignments?classId=1`
- `POST /api/assignments`
- `GET /api/submissions/matrix/:assignmentId` – bảng tổng hợp
- `GET /api/submissions?studentId=4`
- `POST /api/submissions/upload` – multipart `file` + `assignmentId`
- `PATCH /api/submissions/:id/grade` – `{score, teacherComment, status}`

### Materials
- `GET /api/materials?courseId=1`
- `POST /api/materials/upload` – multipart

### Payments
- `GET /api/payments?classId=1`
- `GET /api/payments/summary` (Admin)
- `PATCH /api/payments/:id/pay` – `{paidAmount?}`

### Notifications + Alert Rules
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/read-all`
- `GET /api/notifications/rules/:classId`
- `POST /api/notifications/rules/:classId` – `{maxTotalAbsences, maxConsecutiveAbsences, maxMissingAssignments}`

### Calendar
- `GET /api/calendar?start=2025-03-01&end=2025-04-30`
- `POST /api/calendar`

## Cron jobs

Cảnh báo tự động chạy mỗi ngày 8h sáng – check vắng / không nộp bài theo `alert_rules`.

## Cấu trúc

```
src/
├── main.ts
├── app.module.ts
├── common/             # guards, decorators
│   ├── current-user.decorator.ts
│   └── roles.guard.ts
└── modules/
    ├── auth/
    ├── users/
    ├── courses/
    ├── classes/
    ├── enrollments/
    ├── sessions/
    ├── attendance/
    ├── grade-items/
    ├── grades/
    ├── assignments/
    ├── submissions/
    ├── materials/
    ├── payments/
    ├── notifications/
    └── calendar/
```
