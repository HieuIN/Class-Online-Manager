# 🎓 ClassManager – Quản lý lớp học online

App quản lý lớp học cho giáo viên dạy online theo nhóm nhỏ. Theo dõi điểm danh, điểm số, bài tập, học phí, tiến độ.

## 🧩 Tech Stack

- **Backend**: NestJS 10 + TypeORM + PostgreSQL + JWT auth
- **Frontend**: Vue 3 + Vite + Element Plus + Pinia + ECharts
- **Database**: PostgreSQL với 15 bảng

## 🚀 Chạy nhanh

### 1. PostgreSQL

```bash
createdb class_manager
psql class_manager < database/schema.sql
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env       # sửa DB info nếu cần
npm run start:dev
# API ở http://localhost:3000/api
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Web ở http://localhost:5173
```

### 4. Đăng nhập (password: `password123`)

| Role | Email |
|------|-------|
| Giáo viên | `teacher@cm.com` |
| Học viên | `student1@cm.com` |
| Admin | `admin@cm.com` |

## 📂 Cấu trúc

```
class-manager/
├── database/
│   └── schema.sql          # PostgreSQL schema + seed data
├── backend/                # NestJS API
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/         # guards + decorators
│   │   └── modules/        # 15 modules
│   │       ├── auth/
│   │       ├── users/
│   │       ├── courses/
│   │       ├── classes/
│   │       ├── enrollments/
│   │       ├── sessions/
│   │       ├── attendance/
│   │       ├── grade-items/
│   │       ├── grades/
│   │       ├── assignments/
│   │       ├── submissions/
│   │       ├── materials/
│   │       ├── payments/
│   │       ├── notifications/
│   │       └── calendar/
│   └── README.md           # API docs
└── frontend/               # Vue 3 SPA
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── stores/
    │   ├── router/
    │   ├── utils/
    │   └── views/          # teacher/student/admin/shared
    └── README.md
```

## ✨ Tính năng theo Phase

### Phase 1 (MVP) – Đã làm xong ✅

- ✅ Auth JWT + 3 vai trò (Admin/Teacher/Student)
- ✅ Quản lý lớp, khóa học, học viên, enrollment
- ✅ Điểm danh theo buổi (PRESENT/ABSENT/LATE/EXCUSED)
- ✅ Quản lý điểm với cột điểm + hệ số → tự tính TB
- ✅ Bài tập + nộp bài (upload file) + chấm điểm
- ✅ Tài liệu (upload theo chương/bài)
- ✅ Tiến độ khóa học (kế hoạch vs thực tế)
- ✅ Học phí (đã đóng/chưa đóng/một phần)
- ✅ Thông báo + rule cảnh báo tự động (cron 8h hàng ngày)
- ✅ Lịch học (calendar tháng)
- ✅ Báo cáo & biểu đồ (phân bố điểm, chuyên cần, nộp bài)

### Phase 2 (Mở rộng) – Để dành sau

- ⏳ Đánh giá cuối khóa từ học viên
- ⏳ Export Excel/PDF báo cáo
- ⏳ Push notifications (web/mobile)
- ⏳ Online tests / quiz tự động
- ⏳ Group chat / live message
- ⏳ Multi-tenant cho nhiều trung tâm

## 🔧 Tùy chỉnh

### Thêm khóa học/lớp mới
- Vào Admin hoặc Teacher → Quản lý lớp → "+ Tạo lớp"
- Cấu hình tổng số buổi, học phí, lịch học

### Cấu hình cảnh báo
- Vào Thông báo → Cài đặt cảnh báo tự động
- Set ngưỡng: vắng X buổi / vắng liên tiếp / không nộp N bài
- Cron job chạy mỗi 8h sáng tự gửi thông báo

### Đổi password mặc định
```sql
UPDATE users SET password_hash = '<bcrypt hash>' WHERE email = 'teacher@cm.com';
```
Tạo hash mới: `node -e "console.log(require('bcrypt').hashSync('mật-khẩu-mới', 10))"`

## 📝 License

MIT – tự do dùng cho công việc cá nhân + thương mại.

---

**Made for vợ ❤️**
