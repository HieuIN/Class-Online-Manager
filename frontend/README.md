# Class Manager Frontend (Vue 3 + Vite + Element Plus)

## Cài đặt

```bash
cd frontend
npm install
npm run dev      # development - http://localhost:5173
npm run build    # build production -> dist/
```

Backend phải chạy trước ở `http://localhost:3000`. Vite tự proxy `/api` và `/uploads` sang backend.

## Cấu trúc

```
src/
├── main.js
├── App.vue
├── assets/main.css       # global styles + theme
├── api/
│   ├── http.js           # axios instance + interceptors
│   └── index.js          # tất cả API endpoints
├── components/
│   └── ClassPicker.vue   # dropdown chọn lớp (dùng chung)
├── stores/
│   ├── auth.js           # pinia store user + token
│   └── class.js          # pinia store lớp đang chọn
├── router/index.js       # routes + role guard
├── utils/format.js       # helpers format ngày/tiền/badge
└── views/
    ├── auth/Login.vue
    ├── AppLayout.vue              # sidebar layout
    ├── teacher/
    │   ├── Dashboard.vue
    │   ├── Attendance.vue
    │   ├── Grades.vue
    │   ├── Assignments.vue
    │   ├── Progress.vue
    │   └── Analytics.vue
    ├── student/
    │   ├── StudentDashboard.vue
    │   ├── StudentGrades.vue
    │   ├── StudentAssignments.vue
    │   └── StudentAttendance.vue
    ├── admin/
    │   └── AdminDashboard.vue
    └── shared/
        ├── Classes.vue
        ├── Materials.vue
        ├── Calendar.vue
        ├── Payments.vue
        └── Notifications.vue
```

## Tính năng đã làm

**Giáo viên (11 màn hình):**
- Dashboard tổng quan (metrics + lớp + thông báo)
- Quản lý lớp + danh sách học viên
- Điểm danh theo từng buổi (bulk mark)
- Quản lý điểm (multi-column + tự tính TB)
- Bài tập (tạo, chấm, feedback)
- Tiến độ khóa học (kế hoạch vs thực tế)
- Thư viện tài liệu (upload theo chương/bài)
- Lịch học (calendar tháng)
- Báo cáo (biểu đồ ECharts)
- Quản lý học phí (ghi nhận thanh toán)
- Thông báo + cài đặt cảnh báo tự động

**Học viên (7 màn hình):**
- Dashboard (chuyên cần, bài cần nộp, lịch)
- Điểm của tôi
- Bài tập (nộp file)
- Điểm danh của tôi
- Tài liệu / Lịch / Thông báo (shared)

**Admin (4 màn hình):**
- Dashboard tổng quan toàn hệ thống
- Quản lý lớp / Học phí / Báo cáo (shared)
