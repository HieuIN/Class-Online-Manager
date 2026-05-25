# Deploy v1 - CTalk

Khuyến nghị v1: deploy trên Render vì app có NestJS API, Socket.IO, PostgreSQL và upload file. Frontend dùng Static Site, backend dùng Web Service, database dùng Render PostgreSQL.

## 1. Tên miền

Các tên nên thử đăng ký:

- `ctalk.app`
- `ctalk.school`
- `ctalk.edu.vn`
- `ctalk.vn`
- `ctalkclass.com`
- `ctalkcenter.com`
- `ctalkhsk.com`

Nếu muốn nhanh và ít cấu hình, có thể dùng tạm domain Render:

- Frontend: `https://ctalk.onrender.com`
- API: `https://ctalk-api.onrender.com`

Khi mua domain riêng, cấu hình DNS:

- `ctalk.<tld>` hoặc `www.ctalk.<tld>` trỏ về frontend Render Static Site.
- `api.ctalk.<tld>` trỏ về backend Render Web Service.

Sau khi gắn domain thật, cập nhật env:

- Backend `CORS_ORIGIN=https://ctalk.<tld>`
- Backend `FRONTEND_URL=https://ctalk.<tld>`
- Frontend `VITE_API_URL=https://api.ctalk.<tld>/api`
- Frontend `VITE_SOCKET_URL=https://api.ctalk.<tld>`

## 2. Deploy bằng Render Blueprint

1. Push repo lên GitHub.
2. Render -> New -> Blueprint -> chọn repo.
3. Render đọc file `render.yaml` và tạo:
   - `ctalk-api`
   - `ctalk`
   - `ctalk-db`
4. Điền các env secret còn trống:
   - `SMTP_HOST`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   - `ANTHROPIC_API_KEY`
5. Deploy.

## 3. Seed database production

Sau khi DB tạo xong, chạy SQL trong Render PostgreSQL shell hoặc local `psql`:

```powershell
psql "<external database url>" -f database/schema.sql
psql "<external database url>" -f database/batch_3_5_extras.sql
```

Không dùng tài khoản demo cho production lâu dài. Sau khi seed, đăng nhập admin và đổi mật khẩu.

## 4. Upload file

Backend dùng persistent disk:

```text
UPLOAD_DIR=/var/data/uploads
```

Các file upload sẽ sống qua deploy/restart trong disk `ctalk-uploads`.

## 5. Kiểm tra sau deploy

- `https://ctalk-api.onrender.com/api/health` trả `{ ok: true }`
- Frontend mở được dashboard.
- Login thử `admin@cm.com`, đổi mật khẩu ngay.
- Upload avatar và flashcard media thử.
- Forum realtime hoạt động.
- Forgot password gửi email qua SMTP.
- AI feedback hoạt động nếu có `ANTHROPIC_API_KEY`.
