# 📝 Prompts cho Claude Code – Class Manager

Copy nguyên đoạn prompt (bao gồm cả phần "Yêu cầu:" + "Files cần chỉnh:") và paste vào Claude Code panel trong VS Code. Sau khi xong feature, commit git: `git commit -m "feat: <tên feature>"`.

---

## 🔥 PHASE A – TÍNH NĂNG QUAN TRỌNG NHẤT

### 🅰️1. Link Zoom/Google Meet cho mỗi buổi học

```
Thêm tính năng link Zoom/Meet cho từng buổi học.

Yêu cầu:
- Database: ALTER bảng sessions thêm cột meeting_url (text, nullable). Update database/schema.sql cho người mới setup.
- Backend (sessions.module.ts): Thêm field meetingUrl vào entity ClassSession (@Column name: 'meeting_url').
- Frontend - Attendance.vue (teacher): Thêm input "Link Zoom/Meet" vào dialog tạo/sửa session, lưu vào newSession.meeting_url.
- Frontend - StudentDashboard.vue: Thêm 1 card "Buổi học sắp tới" hiển thị 3 session gần nhất (status PLANNED, sắp xếp theo planned_date). Mỗi item có nút "Tham gia" nếu meeting_url tồn tại và session diễn ra trong 24h tới, click sẽ mở link trong tab mới.
- Frontend - Attendance.vue, danh sách "Buổi học sắp tới": thêm icon link kế bên tên buổi nếu có meeting_url, click copy link.

Lưu ý:
- Hỗ trợ cả link Zoom (zoom.us) và Google Meet (meet.google.com), không validate URL.
- Sau khi xong, ALTER TABLE thủ công: ALTER TABLE sessions ADD COLUMN meeting_url TEXT;
- Update CLAUDE.md tick item này trong Phase A.
```

---

### 🅰️2. Tự sinh lịch học khi tạo lớp

```
Thêm tính năng tự sinh sessions khi tạo lớp mới.

Yêu cầu:
- Frontend - Classes.vue (dialog Tạo lớp mới):
  + Thêm fields mới:
    * "Ngày bắt đầu" (date picker)
    * "Các thứ trong tuần" (multi-select: T2, T3, T4, T5, T6, T7, CN - dùng el-checkbox-group)
    * "Giờ bắt đầu" + "Giờ kết thúc" (time picker)
  + Khi submit, sau khi tạo lớp thành công, gọi API tự sinh sessions
- Backend (sessions.module.ts): Thêm endpoint POST /sessions/generate
  Body: { classId, startDate, weekdays: [2,4,6], startTime: '19:00', endTime: '21:00', totalSessions }
  Logic: bắt đầu từ startDate, lặp qua từng ngày, nếu day-of-week có trong weekdays thì tạo 1 session (session_no tăng dần từ 1), dừng khi đã tạo đủ totalSessions.
- Topic mặc định "Buổi X" - GV sẽ sửa sau.

Lưu ý:
- T2=1, T3=2, T4=3, T5=4, T6=5, T7=6, CN=0 (dayjs convention)
- Hiển thị toast "Đã tạo X buổi học" sau khi xong
- Update CLAUDE.md
```

---

### 🅰️3. Hóa đơn PDF cho học phí

```
Thêm tính năng xuất hóa đơn PDF cho từng payment.

Yêu cầu:
- Cài package backend: npm install pdfkit @types/pdfkit
- Backend - payments.module.ts: thêm endpoint GET /payments/:id/invoice
  Logic: lấy thông tin payment + student + class, dùng pdfkit tạo PDF có:
    * Logo "ClassManager" + tên trung tâm
    * Mã hóa đơn: INV-{paymentId}-{YYYYMM}
    * Thông tin học viên: tên, email, SĐT
    * Thông tin lớp: tên lớp, GV, lịch học
    * Bảng: Mô tả | Số tiền (1 dòng cho học phí)
    * Tổng tiền, đã đóng, còn lại
    * Trạng thái (PAID/PENDING/PARTIAL)
    * Ngày xuất hóa đơn
    * Chữ ký GV (placeholder)
  Response: PDF binary với Content-Type: application/pdf, filename "hoa-don-{studentName}-{date}.pdf"
- Frontend - Payments.vue: thêm cột "Hóa đơn" với button "↓ PDF" → gọi API → download file
- API client (api/index.js): paymentsApi.downloadInvoice(id) = http.get(`/payments/${id}/invoice`, { responseType: 'blob' })

Lưu ý:
- Hỗ trợ tiếng Việt: dùng font Roboto từ Google Fonts (tải về backend/assets/fonts/Roboto-Regular.ttf), pdfkit register font trước khi dùng
- Nếu không muốn xử lý font tiếng Việt, thay thế tạm tiếng Việt bằng tiếng Anh
- Update CLAUDE.md
```

---

### 🅰️4. Báo cáo doanh thu theo tháng

```
Thêm trang Báo cáo doanh thu cho Admin.

Yêu cầu:
- Backend - payments.module.ts: thêm endpoint GET /payments/revenue-report?from=YYYY-MM-DD&to=YYYY-MM-DD
  Logic SQL: tính tổng paid_amount group by tháng và lớp:
    SELECT DATE_TRUNC('month', paid_at) as month, c.id as class_id, c.name as class_name,
           SUM(p.paid_amount) as revenue, COUNT(*) as payment_count
    FROM payments p JOIN classes c ON c.id = p.class_id
    WHERE paid_at BETWEEN $1 AND $2 AND p.status = 'PAID'
    GROUP BY month, c.id, c.name
    ORDER BY month, c.name
- Frontend - tạo file mới src/views/admin/Revenue.vue:
  + Date range picker (mặc định: 12 tháng gần nhất)
  + Card metric: Tổng doanh thu kỳ, Trung bình/tháng, Tổng số giao dịch
  + ECharts line chart: doanh thu theo tháng (1 đường tổng + nhiều đường theo lớp)
  + ECharts pie chart: tỉ trọng doanh thu theo lớp
  + Bảng chi tiết: Tháng | Lớp | Doanh thu | Số GD
  + Nút "↓ Xuất CSV"
- Router: thêm route /admin/revenue
- AppLayout.vue adminNav: thêm menu "Doanh thu" với icon TrendCharts

Lưu ý:
- Format tiền VN: dùng fmtMoney helper có sẵn
- Update CLAUDE.md
```

---

### 🅰️5. Reminder tự động trước buổi học (qua console + DB notification)

```
Thêm cron job reminder trước buổi học 1 giờ.

Yêu cầu:
- Backend - notifications.module.ts:
  + Thêm cron job mới chạy mỗi 15 phút (CronExpression.EVERY_15_MINUTES):
    Logic: query sessions có status='PLANNED' và planned_date là hôm nay và (planned_date + start_time) cách hiện tại từ 45-75 phút
    Cho mỗi session đó, query enrollments để lấy danh sách học viên + giáo viên, tạo notification cho mỗi người:
      title: 'Buổi học sắp bắt đầu'
      content: 'Lớp <className> sẽ bắt đầu lúc <time>. <Có link Zoom hay không>'
      notif_type: 'REMINDER'
      related_url: meeting_url (nếu có)
  + Tránh gửi trùng: trước khi tạo, check notifications đã có notif_type='REMINDER' và content chứa session_id chưa
- Frontend - Notifications.vue: hiển thị notif loại REMINDER với màu xanh dương (badge-blue), icon clock
- AppLayout.vue: badge số chưa đọc real-time cập nhật mỗi 30s (giảm từ 60s xuống 30s)

Lưu ý:
- Test bằng cách tạo session với planned_date hôm nay và time gần 1h sau, rồi gọi POST /notifications/test-trigger để trigger manually
- Update CLAUDE.md
```

---

### 🅰️6. Quên mật khẩu / reset qua email (đơn giản, không cần SMTP)

```
Thêm tính năng quên mật khẩu - dùng cách đơn giản: admin generate reset link, gửi tay cho user.

Yêu cầu:
- Database: tạo bảng password_reset_tokens (id, user_id, token UUID, expires_at, used boolean default false)
  CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
- Backend - auth.module.ts:
  + POST /auth/forgot-password { email } → tạo token UUID, expires_at = NOW() + 1h, trả về { resetUrl: 'http://localhost:5173/reset-password?token=XXX' } để admin copy gửi user
  + POST /auth/reset-password { token, newPassword } → verify token chưa used, chưa expire, update user password, mark token used
- Frontend:
  + Trang mới /forgot-password (auth/ForgotPassword.vue): input email → gọi API → hiện link (cho admin copy)
  + Trang mới /reset-password (auth/ResetPassword.vue): lấy token từ query string, input password mới + confirm → gọi API → redirect login
  + Login.vue: thêm link "Quên mật khẩu?" dưới nút Đăng nhập
- Router: thêm 2 routes public

Lưu ý:
- Cách này là semi-manual: admin copy link đưa user. Khi nào có SMTP sẽ tự gửi email sau.
- Token UUID dùng package 'uuid' đã cài sẵn
- Update CLAUDE.md
```

---

## 🌟 PHASE B – TÍNH NĂNG TĂNG GIÁ TRỊ

### 🅱️1. Forum trong lớp (đơn giản, không real-time)

```
Thêm forum đơn giản trong mỗi lớp - GV và HV đăng tin, comment.

Yêu cầu:
- Database: tạo 2 bảng
  CREATE TABLE class_posts (
    id SERIAL PRIMARY KEY,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id),
    title VARCHAR(255),
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE post_comments (
    id SERIAL PRIMARY KEY,
    post_id INT REFERENCES class_posts(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
- Backend: tạo module mới `class-posts`:
  + GET /class-posts?classId=X → list posts kèm tên người đăng + số comment
  + POST /class-posts → tạo post (cần auth)
  + DELETE /class-posts/:id → xóa (chỉ author hoặc teacher)
  + GET /class-posts/:id/comments → list comments
  + POST /class-posts/:id/comments → thêm comment
  + Pin/unpin: PATCH /class-posts/:id/pin (chỉ teacher)
- Frontend: tạo view mới src/views/shared/Forum.vue
  + Phải chọn lớp (dùng ClassPicker)
  + Form đăng post (title + content textarea), button "Đăng"
  + List posts sắp xếp: pinned trước, mới nhất trước
  + Mỗi post: tên người đăng + avatar + thời gian + content + nút "X bình luận"
  + Click vào post mở dialog comment, thread comment ở dưới
- Router: /forum
- AppLayout.vue: thêm vào teacherNav + studentNav menu "Bảng tin" với icon ChatDotRound

Lưu ý:
- Pinned post: icon 📌 đỏ
- HV/GV cùng xem, GV có quyền pin + xóa post của HV
- Update CLAUDE.md
```

---

### 🅱️2. Quiz online tự chấm

```
Thêm tính năng quiz trắc nghiệm tự chấm điểm cho HV.

Yêu cầu:
- Database: tạo 3 bảng
  CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit_minutes INT,
    available_from TIMESTAMP,
    available_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
    correct_answer CHAR(1),
    points NUMERIC(5,2) DEFAULT 1,
    display_order INT DEFAULT 0
  );
  CREATE TABLE quiz_attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB,
    score NUMERIC(5,2),
    started_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP
  );

- Backend: tạo module `quizzes` với endpoints:
  + GET /quizzes?classId=X
  + POST /quizzes (teacher only) - tạo quiz + questions cùng lúc
  + PATCH /quizzes/:id, DELETE /quizzes/:id
  + GET /quizzes/:id - chi tiết kèm questions (HV xem KHÔNG có correct_answer)
  + GET /quizzes/:id/full (teacher only) - chi tiết KÈM correct_answer
  + POST /quizzes/:id/start - HV bắt đầu làm, tạo quiz_attempt
  + POST /quiz-attempts/:id/submit { answers: { questionId: 'A' } } - chấm tự động, tính score
  + GET /quiz-attempts?studentId=X (HV xem lịch sử) hoặc ?quizId=X (teacher xem ai làm)

- Frontend - Teacher:
  + Tab Bài tập (Assignments.vue) → thêm sub-tab "Quiz"
  + Hoặc tạo riêng src/views/teacher/Quizzes.vue với menu mới "Quiz" trong sidebar
  + List quiz, button "+ Tạo quiz" mở dialog full-screen: thông tin chung + thêm/sửa/xóa câu hỏi (form lặp với 4 đáp án + chọn đáp án đúng)
  + Xem kết quả: bảng học viên + điểm

- Frontend - Student: src/views/student/StudentQuizzes.vue
  + List quiz available
  + Click vào quiz → trang làm quiz: question theo trang, timer countdown, button Submit
  + Sau submit hiện kết quả: điểm, đáp án đúng/sai

- Router + menu

Lưu ý:
- Quiz chỉ trắc nghiệm 4 đáp án (A/B/C/D) cho đơn giản
- Có thể attempt nhiều lần - mỗi lần lưu 1 quiz_attempt
- Hiển thị thời gian còn lại real-time bằng setInterval
- Update CLAUDE.md
```

---

### 🅱️3. Certificate PDF cuối khóa

```
Thêm tính năng cấp chứng chỉ PDF khi học viên hoàn thành khóa học.

Yêu cầu:
- Backend - tạo module mới `certificates`:
  + GET /certificates/preview/:enrollmentId - GV xem trước cert
  + POST /certificates/issue/:enrollmentId - GV cấp cert (tạo record + sinh PDF)
  + GET /certificates/:id/download - HV/GV tải PDF

- Database: tạo bảng
  CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    enrollment_id INT REFERENCES enrollments(id) ON DELETE CASCADE,
    cert_number VARCHAR(50) UNIQUE NOT NULL,
    issued_at TIMESTAMP DEFAULT NOW(),
    issued_by INT REFERENCES users(id),
    final_score NUMERIC(5,2),
    classification VARCHAR(20)
  );

- Logic PDF (dùng pdfkit):
  + Tiêu đề "CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC"
  + Background pattern hoặc border đẹp (dùng pdfkit draw rectangle)
  + Tên trung tâm + logo (text "ClassManager")
  + "Chứng nhận: <tên học viên>"
  + "Đã hoàn thành khóa học: <tên khóa>"
  + "Lớp: <tên lớp>"
  + "Thời gian học: <start_date> - <end_date>"
  + "Điểm tổng kết: <final_score> – Xếp loại: <classification>"
  + Mã số: <cert_number> dạng CERT-2026-001
  + Ngày cấp + chữ ký GV
  + QR code link verify (optional, có thể bỏ)

- Frontend - Teacher:
  + Trong Classes.vue, bảng học viên: thêm cột "Chứng chỉ" 
    Nếu chưa có cert: button "Cấp chứng chỉ" (chỉ active khi học sinh có điểm TB ≥ 5)
    Nếu đã có: badge "Đã cấp" + button "Tải về"

- Frontend - Student:
  + Trong StudentDashboard.vue, nếu có cert: card "Chứng chỉ của bạn" + button "Tải PDF"

Lưu ý:
- Số cert: CERT-{YYYY}-{padding-3-chars} unique per year
- Học sinh phải có ít nhất 1 grade item với score và average ≥ 5 mới cấp được
- Update CLAUDE.md
```

---

## 🎨 PHASE C – NICE-TO-HAVE

### 🅲1. Dark Mode

```
Thêm Dark mode toggle.

Yêu cầu:
- Tạo store mới src/stores/theme.js (Pinia): { mode: 'light' | 'dark' }, lưu vào localStorage
- main.js: khi load app, đọc localStorage và apply class 'dark' lên <html> nếu mode = dark
- assets/main.css: thêm CSS variables cho dark mode:
  html.dark { --bg-primary: #1a1a18; --bg-secondary: #2a2a28; --text-primary: #f0f0ee; --border: rgba(255,255,255,0.1); ... }
  Body và mọi element dùng var() cho color/background
- Element Plus có built-in dark mode: import 'element-plus/theme-chalk/dark/css-vars.css' trong main.js
- AppLayout.vue: thêm toggle button (icon Moon/Sun) trong header, click đổi theme
- Profile.vue: thêm option chọn theme

Lưu ý:
- Test toàn bộ pages xem có element nào hardcode màu trắng/đen không
- Element Plus: thêm class "dark" vào <html>, các component tự đổi
- Update CLAUDE.md
```

---

### 🅲2. Upload avatar

```
Thêm tính năng upload avatar cho user.

Yêu cầu:
- Backend - users.module.ts: thêm endpoint POST /users/:id/avatar (multipart upload), lưu vào uploads/avatars/, update user.avatar_url
- Frontend - Profile.vue: thay block "avatar-section" thành el-upload với crop preview, button "Tải ảnh lên"
- AppLayout.vue: nếu user.avatarUrl tồn tại, hiển thị img thay vì initials
- Tất cả các place dùng avatar (Classes.vue, Attendance.vue...): wrapper component nhỏ <UserAvatar :user="user"> tự decide initials hoặc img

Lưu ý:
- Giới hạn file 2MB, chỉ image (jpg/png/webp)
- Tạo folder backend/uploads/avatars/
- Update CLAUDE.md
```

---

### 🅲3. i18n (Tiếng Anh / Tiếng Việt)

```
Thêm hỗ trợ đa ngôn ngữ VN/EN.

Yêu cầu:
- Cài: npm install vue-i18n@9 trong frontend
- Tạo src/locales/vi.json và en.json với key cho TẤT CẢ chuỗi tiếng Việt trong app
  Ví dụ keys: "common.save", "common.cancel", "auth.login", "menu.classes", "table.student", ...
- main.js: setup vue-i18n
- Replace mọi chuỗi tiếng Việt trong .vue files thành {{ $t('key') }}
- Store theme + locale chung trong src/stores/settings.js
- AppLayout.vue header: thêm dropdown chọn ngôn ngữ (VN/EN)

Lưu ý:
- Element Plus có sẵn locale: import { useLocale } từ element-plus
- Có thể làm từng phần, không cần làm hết 1 lần
- Update CLAUDE.md
```

---

### 🅲4. AI gợi ý nhận xét (dùng Anthropic API)

```
Thêm tính năng AI gợi ý nhận xét cho học viên dựa trên dữ liệu điểm/chuyên cần.

Yêu cầu:
- Backend - cài npm install @anthropic-ai/sdk
- Tạo module mới `ai-suggestions`:
  + POST /ai/suggest-feedback
    Body: { studentId, classId }
    Logic:
      - Query: tên HV, điểm các cột, chuyên cần (PRESENT/ABSENT/LATE counts), số bài chưa nộp
      - Build prompt cho Claude API:
        "Bạn là GV. Học viên <tên> trong lớp <tên lớp>. Dữ liệu:
         - Điểm: <list điểm>
         - Chuyên cần: X% (vắng Y buổi)
         - Bài tập: nộp Z/T bài
         Hãy viết 2-3 câu nhận xét bằng tiếng Việt, mang tính xây dựng, gợi ý cải thiện."
      - Gọi Claude API (model claude-haiku-4-5)
      - Trả về { suggestion: text }
- Cấu hình: thêm ANTHROPIC_API_KEY trong .env
- Frontend - Grades.vue: trong dialog Feedback, thêm button "✨ AI gợi ý" 
  Click → loading → kết quả paste vào textarea feedback (user có thể sửa trước khi save)

Lưu ý:
- Phải có ANTHROPIC_API_KEY (đăng ký tại console.anthropic.com)
- Cẩn thận cost: chỉ generate khi user request, không auto
- Update CLAUDE.md
```

---

### 🅲5. Mobile PWA

```
Convert app thành PWA để cài đặt trên điện thoại.

Yêu cầu:
- Cài: npm install vite-plugin-pwa
- vite.config.js: thêm plugin PWA với:
  + name: "ClassManager"
  + short_name: "ClassMgr"  
  + theme_color: "#1D9E75"
  + icons: 192x192, 512x512 (tạo từ SVG logo)
  + start_url: "/"
  + display: "standalone"
- Generate icons từ logo SVG (dùng tool online hoặc canvas API)
- Test responsive ở mobile: tất cả pages phải hiển thị tốt trên width 380px (đã có @media query cơ bản, kiểm tra lại)
- AppLayout.vue: thêm sidebar collapsible cho mobile (hamburger menu)

Lưu ý:
- Test bằng cách build production rồi mở trên điện thoại cùng wifi: npm run build && npm run preview
- Update CLAUDE.md
```

---

## 🎯 Tips khi dùng các prompts này

### 1. Bắt đầu nhỏ trước
Đừng làm hết 1 lượt. Làm 1 feature → test kỹ → commit → mới làm tiếp.

### 2. Plan mode cho feature lớn
Chọn **Plan mode** (góc dưới Claude Code panel) trước khi paste prompt phức tạp.

### 3. Sau khi feature xong
```powershell
git add .
git commit -m "feat: <ngắn gọn>"
```
Sai → `git reset --hard HEAD`

### 4. Sửa nếu lỗi
Sau khi Claude làm xong, nếu test thấy lỗi, prompt tiếp:
> "Tôi test thấy lỗi <copy error message>, fix lại"

### 5. Thứ tự đề xuất
1. **A1 (Zoom link)** — đơn giản, dùng được ngay
2. **A2 (Auto sinh lịch)** — tiết kiệm thời gian setup mỗi lớp mới
3. **A6 (Quên mật khẩu)** — quan trọng cho user thật
4. **A3 (Hóa đơn PDF)** — dùng cho gửi phụ huynh
5. **A4 (Báo cáo doanh thu)** — admin cần
6. **A5 (Reminder)** — nice automation
7. **B1 (Forum)** — engagement
8. **B2 (Quiz)** — feature lớn, khác biệt
9. **C1 (Dark mode)** — UX
10. **B3 (Certificate)** — wow factor

---

## 🆘 Khi prompt không work

Nếu Claude Code làm sai/thiếu, prompt fix:

```
File <tên file> bị lỗi <copy error>. Fix lại.
```

```
Tính năng vừa làm xong chưa hoạt động: <mô tả triệu chứng>. Debug và fix.
```

```
Revert toàn bộ thay đổi vừa rồi.
```

Hoặc dùng git: `git reset --hard HEAD` rồi prompt lại với context rõ hơn.
