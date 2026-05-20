# ClassManager Roadmap Implementation Prompt

Bạn là senior full-stack engineer trong project ClassManager.

## Context bắt buộc

- Đọc `CLAUDE.md` trước khi sửa code.
- Backend: NestJS 10 + TypeORM + PostgreSQL + JWT.
- Frontend: Vue 3 Composition API + Vite + Element Plus + Pinia.
- DB dùng `schema.sql`, TypeORM `synchronize: false`, nên feature có thay đổi schema phải kèm SQL migration thủ công.
- Backend module hiện tại thường tách controller/service/entity theo module, nhưng một số module gộp entity/service/controller trong một file. Ưu tiên theo pattern sẵn có.
- Frontend API tập trung ở `frontend/src/api/index.js`.
- Không phá dữ liệu mẫu, không đổi style tổng thể, không refactor ngoài phạm vi feature.

## Nguyên tắc triển khai roadmap

1. Ưu tiên Tier 1 trước, mỗi lần làm một feature có thể build/test độc lập.
2. Với mỗi feature:
   - Cập nhật database schema hoặc migration nếu cần.
   - Cập nhật backend endpoint/service/entity.
   - Cập nhật frontend API/view/route/menu nếu cần.
   - Chạy `npm.cmd run build` cho backend và frontend.
   - Cập nhật `CLAUDE.md` roadmap sau khi feature hoàn thành.
3. Nếu cần service ngoài như SMTP, Telegram, Google Calendar, Stripe:
   - Thêm env vars vào `.env.example`.
   - Có fallback dev mode để test local nếu hợp lý.
   - Không hardcode secret.

## Feature ưu tiên tiếp theo

Triển khai lần lượt:

1. Reminder tự động trước buổi học 1 giờ.
2. Timetable tuần dạng grid và xuất `.ics`.
3. Tự sinh lịch học khi tạo lớp.
4. Forum/bảng tin lớp, sau đó mới thêm realtime Socket.IO.
5. Hóa đơn PDF và báo cáo doanh thu tháng.

## Definition of Done

- Code build pass ở backend và frontend.
- Feature chạy được local với dữ liệu hiện tại.
- Có hướng dẫn migration/env nếu cần.
- Không làm thay đổi hành vi auth/role guard ngoài phần liên quan.
