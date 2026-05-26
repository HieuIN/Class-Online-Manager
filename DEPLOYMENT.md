# Deploy v1 - CTalk Chinese

Domain production: `ctalkchinese.com`

Khuyến nghị v1: frontend deploy trên Cloudflare, backend và database deploy trên Render vì app có NestJS API, Socket.IO, PostgreSQL và upload file.

## 1. Tên miền

DNS cần cấu hình:

- `ctalkchinese.com` trỏ về Cloudflare Worker/Pages frontend.
- `www.ctalkchinese.com` redirect hoặc trỏ về frontend.
- `api.ctalkchinese.com` trỏ về Render backend.

Env production:

- Backend `CORS_ORIGIN=https://ctalkchinese.com`
- Backend `FRONTEND_URL=https://ctalkchinese.com`
- Frontend `VITE_API_URL=https://api.ctalkchinese.com/api`
- Frontend `VITE_SOCKET_URL=https://api.ctalkchinese.com`

## 2. Deploy backend + database bằng Render Blueprint

1. Push repo lên GitHub.
2. Render -> New -> Blueprint -> chọn repo.
3. Render đọc file `render.yaml` và tạo:
   - `ctalk-api`
   - `ctalk-db`
4. Điền các env secret còn trống:
   - `SMTP_HOST`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   - `ANTHROPIC_API_KEY`
5. Deploy.

Nếu không muốn dùng frontend Render, có thể xóa/bỏ qua service `ctalk` trong Render và chỉ dùng Cloudflare cho frontend.

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

- `https://api.ctalkchinese.com/api/health` trả `{ ok: true }`
- `https://ctalkchinese.com` mở được dashboard.
- Login thử `admin@cm.com`, đổi mật khẩu ngay.
- Upload avatar và flashcard media thử.
- Forum realtime hoạt động.
- Forgot password gửi email qua SMTP.
- AI feedback hoạt động nếu có `ANTHROPIC_API_KEY`.
