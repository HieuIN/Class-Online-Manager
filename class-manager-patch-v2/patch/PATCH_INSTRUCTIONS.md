# 🔧 Class Manager - Patch v2

Bản nâng cấp với nhiều tính năng quan trọng.

## 🎁 Tính năng mới

### Frontend
1. ✅ **Xem nội dung bài đã nộp** — GV click "Xem" trong bảng nộp bài để tải/xem file học viên nộp (có preview ảnh inline)
2. ✅ **Thêm học viên vào lớp** — bulk add từ HV có sẵn, hoặc tạo HV mới + tự động đăng ký
3. ✅ **Xóa học viên khỏi lớp**
4. ✅ **Sửa/xóa lớp học** (dropdown ⋮ trên thẻ lớp)
5. ✅ **Sửa/xóa bài tập, cột điểm, buổi học**
6. ✅ **Tạo buổi học đầy đủ** (status, ngày thực tế, ghi chú, xóa được)
7. ✅ **Điểm danh nhanh "Tất cả có mặt/vắng"** + ghi chú lý do
8. ✅ **Xuất Excel/CSV** điểm danh + bảng điểm
9. ✅ **Nhận xét cho từng cột điểm** (feedback đính kèm điểm)
10. ✅ **Trang hồ sơ cá nhân** — đổi tên, đổi mật khẩu
11. ✅ **Admin: Quản lý người dùng** (tạo, sửa, khóa, reset password)
12. ✅ **Admin: Quản lý khóa học** (CRUD khóa)

### Backend
1. ✅ Endpoint `/auth/change-password`
2. ✅ Tự động tạo `payment` khi enroll học viên vào lớp (dựa trên `tuition_fee`)
3. ✅ Enroll lại học viên đã từng rút khỏi lớp (reactivate)

---

## 📥 Cách áp dụng

### Bước 1: Giải nén patch

Giải nén file `class-manager-patch-v2.zip` ra một folder tạm. Cấu trúc:

```
patch/
├── frontend/src/...
└── backend/src/...
```

### Bước 2: Copy đè files

Copy **đè** các file từ patch sang project gốc:

```powershell
# Backend
xcopy /Y /S "<patch>\backend\src\*" "E:\04_Projects\Project Nhung\class-manager-fullstack\class-manager\backend\src\"

# Frontend
xcopy /Y /S "<patch>\frontend\src\*" "E:\04_Projects\Project Nhung\class-manager-fullstack\class-manager\frontend\src\"
```

Hoặc copy thủ công từng file qua File Explorer, chọn **"Replace files in destination"** khi hỏi.

### Bước 3: Restart services

**Backend:**
- Trong terminal đang chạy `npm run start:dev`, NestJS sẽ tự reload khi save file. Nhưng để chắc:
  - `Ctrl+C` để stop
  - `npm run start:dev` để chạy lại

**Frontend:**
- Vite tự hot-reload, không cần restart.
- Nếu thấy lỗi import → `Ctrl+C` rồi `npm run dev` lại.

### Bước 4: Hard refresh browser

`Ctrl + F5` ở **http://localhost:5173** để clear cache.

---

## 🧪 Test các tính năng

### Test 1: Thêm học viên vào lớp
1. Login `teacher@cm.com`
2. Menu **Quản lý lớp** → click lớp HSK3
3. Trong section "Học viên" → click **+ Thêm học viên**
4. Tick các học viên chưa có trong lớp → **Thêm**

### Test 2: Tạo học viên mới + auto enroll
1. Trong **Quản lý lớp** → **+ Tạo học viên mới**
2. Nhập họ tên, email, password
3. Tick "Đăng ký vào lớp này luôn" → **Tạo**
4. Học viên mới xuất hiện, tự tạo bản ghi học phí

### Test 3: Xem file bài nộp
1. Login HV `student1@cm.com` → tab **Bài tập**
2. Click **Nộp bài** → chọn file ảnh PNG/JPG (sẽ preview được)
3. Logout → login `teacher@cm.com`
4. Tab **Bài tập** → click bài tương ứng → click **Xem** ở dòng học viên
5. Thấy file + nút **Tải về** + preview ảnh

### Test 4: Đổi mật khẩu
1. Click avatar góc trái dưới → **Hồ sơ**
2. Section "Đổi mật khẩu" → nhập mật khẩu cũ + mới → **Đổi**

### Test 5: Admin quản lý
1. Login `admin@cm.com`
2. Menu mới: **Người dùng**, **Khóa học**
3. Tạo user mới, reset password, xem theo từng role

### Test 6: Xuất Excel
1. Tab **Điểm danh** hoặc **Quản lý điểm** → click **↓ Xuất Excel**
2. File CSV tải về (mở được bằng Excel, encoding UTF-8)

---

## 📝 Lưu ý

- **Học phí tự động tạo**: khi enroll HV mới vào lớp có `tuition_fee > 0`, hệ thống tự tạo payment "PENDING" với hạn 14 ngày
- **Reset password admin**: reset về `password123`
- **CSV tiếng Việt**: file CSV đã thêm BOM UTF-8, Excel mở không lỗi font

---

## 🐛 Nếu lỗi

**"Cannot find module '@/views/admin/Users.vue'"**
→ Frontend cần restart: `Ctrl+C` → `npm run dev`

**Backend không reload**
→ Stop và start lại

**Lỗi 401 sau khi update**
→ Logout & login lại để lấy token mới
