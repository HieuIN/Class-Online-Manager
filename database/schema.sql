-- =====================================================
-- CLASS MANAGER - DATABASE SCHEMA (PostgreSQL)
-- =====================================================

-- =====================================================
-- USERS & ROLES
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'STUDENT', -- ADMIN / TEACHER / STUDENT
    avatar_url      TEXT,
    school          VARCHAR(255),
    parent_name     VARCHAR(255),
    parent_phone    VARCHAR(20),
    is_active       BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- =====================================================
-- COURSES (Khóa học)
-- =====================================================
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,        -- "Tiếng Trung HSK3"
    code            VARCHAR(50) UNIQUE,           -- "CN-HSK3"
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- CLASSES (Lớp cụ thể)
-- =====================================================
CREATE TABLE IF NOT EXISTS classes (
    id              SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,        -- "HSK3 - Tối 2-4-6 Zoom"
    teacher_id      INTEGER REFERENCES users(id),
    total_sessions  INTEGER DEFAULT 0,
    tuition_fee     NUMERIC(12,2) DEFAULT 0,
    start_date      DATE,
    end_date        DATE,
    schedule_note   TEXT,                          -- "Tối 2-4-6, 19:00-21:00"
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_course ON classes(course_id);

-- =====================================================
-- ENROLLMENTS (Học viên thuộc lớp nào)
-- =====================================================
CREATE TABLE IF NOT EXISTS enrollments (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at     TIMESTAMP DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (class_id, student_id)
);

CREATE INDEX idx_enrollments_class ON enrollments(class_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);

-- =====================================================
-- SESSIONS (Buổi học)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    session_no      INTEGER NOT NULL,              -- Buổi 1, 2, 3...
    planned_date    DATE NOT NULL,
    actual_date     DATE,
    start_time      TIME,
    end_time        TIME,
    topic           VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'PLANNED', -- PLANNED / DONE / DELAYED / CANCELLED
    note            TEXT,
    meeting_url     TEXT,                          -- Link Zoom/Google Meet
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT sessions_status_check CHECK (status IN ('PLANNED','DONE','DELAYED','CANCELLED'))
);

CREATE INDEX idx_sessions_class ON sessions(class_id);
CREATE INDEX idx_sessions_date ON sessions(planned_date);

-- =====================================================
-- ATTENDANCE (Điểm danh)
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PRESENT', -- PRESENT / ABSENT / LATE / LEFT_EARLY
    is_excused      BOOLEAN DEFAULT FALSE,         -- vắng có phép?
    reason          TEXT,
    note            TEXT,
    recorded_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE (session_id, student_id),
    CONSTRAINT att_status_check CHECK (status IN ('PRESENT','ABSENT','LATE','LEFT_EARLY'))
);

CREATE INDEX idx_attendance_session ON attendance(session_id);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- =====================================================
-- GRADE ITEMS (Cột điểm)
-- =====================================================
CREATE TABLE IF NOT EXISTS grade_items (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,         -- "Giữa kỳ", "Cuối kỳ", "BT1"
    weight          NUMERIC(5,2) NOT NULL DEFAULT 0, -- hệ số (%)
    max_score       NUMERIC(5,2) NOT NULL DEFAULT 10,
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_grade_items_class ON grade_items(class_id);

-- =====================================================
-- GRADES (Điểm)
-- =====================================================
CREATE TABLE IF NOT EXISTS grades (
    id              SERIAL PRIMARY KEY,
    grade_item_id   INTEGER NOT NULL REFERENCES grade_items(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           NUMERIC(5,2),
    feedback        TEXT,
    graded_at       TIMESTAMP DEFAULT NOW(),
    graded_by       INTEGER REFERENCES users(id),
    UNIQUE (grade_item_id, student_id)
);

CREATE INDEX idx_grades_item ON grades(grade_item_id);
CREATE INDEX idx_grades_student ON grades(student_id);

-- =====================================================
-- ASSIGNMENTS (Bài tập về nhà)
-- =====================================================
CREATE TABLE IF NOT EXISTS assignments (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    due_date        TIMESTAMP NOT NULL,
    attachment_url  TEXT,
    max_score       NUMERIC(5,2) DEFAULT 10,
    is_required     BOOLEAN DEFAULT TRUE,
    submission_type VARCHAR(10) NOT NULL DEFAULT 'BOTH', -- FILE / TEXT / BOTH
    allow_late_submission BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_minutes INTEGER,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT assignments_submission_type_check CHECK (submission_type IN ('FILE','TEXT','BOTH'))
);

CREATE INDEX idx_assignments_class ON assignments(class_id);

CREATE TABLE IF NOT EXISTS assignment_attachments (
    id              SERIAL PRIMARY KEY,
    assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(150),
    file_size       INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assignment_attachments_assignment ON assignment_attachments(assignment_id);

-- =====================================================
-- SUBMISSIONS (Bài nộp)
-- =====================================================
CREATE TABLE IF NOT EXISTS submissions (
    id              SERIAL PRIMARY KEY,
    assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_url        TEXT,
    file_name       VARCHAR(255),
    content_text    TEXT,
    submitted_at    TIMESTAMP DEFAULT NOW(),
    score           NUMERIC(5,2),
    teacher_comment TEXT,
    status          VARCHAR(20) DEFAULT 'SUBMITTED',  -- SUBMITTED / GRADED / REVISION_REQUIRED / NOT_SUBMITTED
    graded_at       TIMESTAMP,
    graded_by       INTEGER REFERENCES users(id),
    UNIQUE (assignment_id, student_id),
    CONSTRAINT subm_status_check CHECK (status IN ('SUBMITTED','GRADED','REVISION_REQUIRED','NOT_SUBMITTED'))
);

CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);

CREATE TABLE IF NOT EXISTS submission_attachments (
    id              SERIAL PRIMARY KEY,
    submission_id   INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(150),
    file_size       INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_submission_attachments_submission ON submission_attachments(submission_id);

-- =====================================================
-- QUIZZES (Trắc nghiệm tự chấm)
-- =====================================================
CREATE TABLE IF NOT EXISTS quizzes (
    id                  SERIAL PRIMARY KEY,
    class_id            INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    time_limit_minutes  INTEGER,
    available_from      TIMESTAMP,
    available_until     TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id              SERIAL PRIMARY KEY,
    quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    option_a        TEXT,
    option_b        TEXT,
    option_c        TEXT,
    option_d        TEXT,
    correct_answer  CHAR(1),
    points          NUMERIC(5,2) DEFAULT 1,
    display_order   INTEGER DEFAULT 0,
    CONSTRAINT quiz_correct_answer_check CHECK (correct_answer IN ('A','B','C','D'))
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id              SERIAL PRIMARY KEY,
    quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers         JSONB,
    score           NUMERIC(5,2),
    started_at      TIMESTAMP DEFAULT NOW(),
    submitted_at    TIMESTAMP
);

CREATE INDEX idx_quizzes_class ON quizzes(class_id);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);

-- =====================================================
-- CERTIFICATES (Chứng chỉ cuối khóa)
-- =====================================================
CREATE TABLE IF NOT EXISTS certificates (
    id              SERIAL PRIMARY KEY,
    enrollment_id   INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    cert_number     VARCHAR(50) UNIQUE NOT NULL,
    issued_at       TIMESTAMP DEFAULT NOW(),
    issued_by       INTEGER REFERENCES users(id),
    final_score     NUMERIC(5,2),
    classification  VARCHAR(20)
);

CREATE INDEX idx_certificates_enrollment ON certificates(enrollment_id);
CREATE INDEX idx_certificates_issued_by ON certificates(issued_by);

-- =====================================================
-- PRONUNCIATION PRACTICE (Luyện phát âm)
-- =====================================================
CREATE TABLE IF NOT EXISTS pronunciation_exercises (
    id                  SERIAL PRIMARY KEY,
    class_id            INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title               VARCHAR(255) NOT NULL,
    prompt_text         TEXT NOT NULL,
    pinyin              TEXT,
    meaning             TEXT,
    sample_audio_url    TEXT,
    due_date            TIMESTAMP,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pronunciation_submissions (
    id                  SERIAL PRIMARY KEY,
    exercise_id         INTEGER NOT NULL REFERENCES pronunciation_exercises(id) ON DELETE CASCADE,
    student_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_url           TEXT NOT NULL,
    duration_seconds    INTEGER,
    score               NUMERIC(5,2),
    teacher_comment     TEXT,
    status              VARCHAR(20) DEFAULT 'SUBMITTED',
    submitted_at        TIMESTAMP DEFAULT NOW(),
    graded_at           TIMESTAMP,
    graded_by           INTEGER REFERENCES users(id),
    UNIQUE (exercise_id, student_id),
    CONSTRAINT pronunciation_submission_status_check CHECK (status IN ('SUBMITTED','GRADED','REVISION_REQUIRED'))
);

CREATE INDEX idx_pronunciation_exercises_class ON pronunciation_exercises(class_id);
CREATE INDEX idx_pronunciation_submissions_exercise ON pronunciation_submissions(exercise_id);
CREATE INDEX idx_pronunciation_submissions_student ON pronunciation_submissions(student_id);

-- =====================================================
-- MATERIALS (Tài liệu)
-- =====================================================
CREATE TABLE IF NOT EXISTS materials (
    id              SERIAL PRIMARY KEY,
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    chapter         VARCHAR(100),
    lesson          VARCHAR(100),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    material_type   VARCHAR(50),                  -- PDF / PPT / DOC / VIDEO / AUDIO / LINK
    file_url        TEXT,
    link_url        TEXT,
    is_required     BOOLEAN DEFAULT FALSE,
    display_order   INTEGER DEFAULT 0,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_materials_course ON materials(course_id);

-- =====================================================
-- CALENDAR EVENTS (Lịch)
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,        -- SESSION / ASSIGNMENT_DUE / EXAM / OTHER
    related_id      INTEGER,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    start_time      TIMESTAMP NOT NULL,
    end_time        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_class ON calendar_events(class_id);
CREATE INDEX idx_calendar_start ON calendar_events(start_time);

-- =====================================================
-- PAYMENTS (Học phí)
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    paid_amount     NUMERIC(12,2) DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'VND',
    status          VARCHAR(20) DEFAULT 'PENDING',  -- PAID / PENDING / PARTIAL
    due_date        DATE,
    paid_at         TIMESTAMP,
    note            TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT pay_status_check CHECK (status IN ('PAID','PENDING','PARTIAL'))
);

CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_class ON payments(class_id);

-- =====================================================
-- FEEDBACKS (Đánh giá khóa học)
-- =====================================================
CREATE TABLE IF NOT EXISTS feedbacks (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (class_id, student_id)
);

-- =====================================================
-- NOTIFICATIONS (Thông báo)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notif_type      VARCHAR(50),                  -- ALERT_ABSENCE / ALERT_HOMEWORK / SYSTEM / GRADE
    title           VARCHAR(255) NOT NULL,
    content         TEXT,
    related_url     VARCHAR(500),
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read);

-- =====================================================
-- CLASS FORUM
-- =====================================================
CREATE TABLE IF NOT EXISTS class_posts (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id),
    title           VARCHAR(255),
    content         TEXT NOT NULL,
    is_pinned       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_class_posts_class ON class_posts(class_id, is_pinned, created_at);

CREATE TABLE IF NOT EXISTS post_comments (
    id              SERIAL PRIMARY KEY,
    post_id         INTEGER NOT NULL REFERENCES class_posts(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS post_attachments (
    id              SERIAL PRIMARY KEY,
    post_id         INTEGER NOT NULL REFERENCES class_posts(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100),
    file_size       INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_post_attachments_post ON post_attachments(post_id);

-- =====================================================
-- ALERT RULES (Rule cảnh báo)
-- =====================================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id                          SERIAL PRIMARY KEY,
    class_id                    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    max_total_absences          INTEGER,
    max_consecutive_absences    INTEGER,
    max_missing_assignments     INTEGER,
    is_active                   BOOLEAN DEFAULT TRUE,
    created_at                  TIMESTAMP DEFAULT NOW(),
    UNIQUE (class_id)
);

-- =====================================================
-- BATCH 3-5 EXTRAS
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS anonymous_feedbacks (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    submitter_hash  VARCHAR(64) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (class_id, submitter_hash)
);

CREATE TABLE IF NOT EXISTS assignment_comments (
    id              SERIAL PRIMARY KEY,
    assignment_id   INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment ON assignment_comments(assignment_id, created_at);

CREATE TABLE IF NOT EXISTS flashcard_decks (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcards (
    id              SERIAL PRIMARY KEY,
    deck_id         INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front           TEXT NOT NULL,
    back            TEXT NOT NULL,
    example         TEXT,
    media_url       TEXT,
    media_type      VARCHAR(20),
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcard_progress (
    id              SERIAL PRIMARY KEY,
    card_id         INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remembered      BOOLEAN DEFAULT FALSE,
    reviewed_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE (card_id, student_id)
);

CREATE TABLE IF NOT EXISTS class_gallery (
    id              SERIAL PRIMARY KEY,
    class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    caption         TEXT,
    uploaded_by     INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_installments (
    id              SERIAL PRIMARY KEY,
    payment_id      INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    due_date        DATE NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    paid_amount     NUMERIC(12,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'PENDING',
    paid_at         TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT payment_installment_status_check CHECK (status IN ('PAID','PENDING','PARTIAL'))
);

CREATE INDEX IF NOT EXISTS idx_payment_installments_payment ON payment_installments(payment_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL PRIMARY KEY,
    actor_id        INTEGER REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100),
    entity_id       INTEGER,
    before_json     JSONB,
    after_json      JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS login_otps (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code            VARCHAR(10) NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    used_at         TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_user ON login_otps(user_id, expires_at);

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint_hash       VARCHAR(64) NOT NULL,
    subscription_json   JSONB NOT NULL,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, endpoint_hash)
);

CREATE TABLE IF NOT EXISTS referral_codes (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code            VARCHAR(30) UNIQUE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS referrals (
    id              SERIAL PRIMARY KEY,
    referrer_id     INTEGER REFERENCES users(id),
    referred_id     INTEGER REFERENCES users(id),
    code            VARCHAR(30),
    discount_amount NUMERIC(12,2) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SEED DATA (Dữ liệu mẫu để test)
-- =====================================================
-- Default password for all seeded users: "password123" (bcrypt hash)
INSERT INTO users (email, phone, password_hash, full_name, role) VALUES
('admin@cm.com', '0900000001', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Quản trị viên', 'ADMIN'),
('teacher@cm.com', '0900000002', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Nguyễn Lan Anh', 'TEACHER'),
('teacher2@cm.com', '0900000003', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Trần Minh Tuấn', 'TEACHER'),
('student1@cm.com', '0901234567', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Lê Minh Khoa', 'STUDENT'),
('student2@cm.com', '0912345678', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Trần Hoa', 'STUDENT'),
('student3@cm.com', '0923456789', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Nguyễn Bảo', 'STUDENT'),
('student4@cm.com', '0934567890', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Phạm Thùy', 'STUDENT'),
('student5@cm.com', '0945678901', '$2b$10$y1Jz61TDC4zcjwtxFOH91.hjO/pnu7wFwhiGeanubNtEOhlgKAhVW', 'Vũ Hoàng', 'STUDENT')
ON CONFLICT DO NOTHING;

INSERT INTO courses (name, code, description, start_date, end_date, created_by) VALUES
('Tiếng Trung HSK3', 'CN-HSK3', 'Khóa học tiếng Trung HSK cấp 3', '2025-01-10', '2025-06-30', 1),
('Tiếng Anh IELTS', 'EN-IELTS', 'Khóa luyện thi IELTS 6.5+', '2025-02-01', '2025-07-31', 1)
ON CONFLICT DO NOTHING;

INSERT INTO classes (course_id, name, teacher_id, total_sessions, tuition_fee, start_date, end_date, schedule_note) VALUES
(1, 'HSK3 - Tối 2-4-6 Zoom', 2, 24, 3000000, '2025-03-03', '2025-06-30', 'Tối 2-4-6, 19:00-21:00'),
(2, 'IELTS - Sáng T7-CN', 3, 20, 4500000, '2025-02-08', '2025-07-31', 'Sáng T7-CN, 8:00-10:00')
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (class_id, student_id) VALUES
(1, 4),(1, 5),(1, 6),(1, 7),(1, 8)
ON CONFLICT DO NOTHING;

INSERT INTO sessions (class_id, session_no, planned_date, actual_date, topic, status) VALUES
(1, 1, '2025-03-03', '2025-03-03', 'Ngữ pháp cơ bản Chương 1', 'DONE'),
(1, 2, '2025-03-05', '2025-03-05', 'Từ vựng chủ đề Gia đình', 'DONE'),
(1, 3, '2025-03-10', '2025-03-10', 'Luyện nghe – Bài tập 1-3', 'DONE'),
(1, 4, '2025-03-12', '2025-03-13', 'Đọc hiểu đoạn văn ngắn', 'DONE'),
(1, 5, '2025-03-17', '2025-03-17', 'Viết câu – Cấu trúc 把字句', 'DONE'),
(1, 6, '2025-03-19', '2025-03-19', 'Kiểm tra giữa kỳ', 'DONE'),
(1, 7, '2025-03-24', '2025-03-24', 'Bài mới – Chương 2', 'DONE'),
(1, 8, '2025-03-26', NULL, 'Luyện nói theo cặp', 'PLANNED'),
(1, 9, '2025-03-31', NULL, 'Từ vựng chủ đề Công việc', 'PLANNED'),
(1, 10, '2025-04-02', NULL, 'Ngữ pháp – Câu phức', 'PLANNED')
ON CONFLICT DO NOTHING;

INSERT INTO grade_items (class_id, name, weight, max_score, display_order) VALUES
(1, 'Bài tập 1', 10, 10, 1),
(1, 'Bài tập 2', 10, 10, 2),
(1, 'Giữa kỳ', 30, 10, 3),
(1, 'Cuối kỳ', 50, 10, 4)
ON CONFLICT DO NOTHING;

INSERT INTO assignments (class_id, title, description, due_date, is_required, created_by) VALUES
(1, 'BT Ngữ pháp Chương 1', 'Làm bài tập trang 12-15', '2025-03-15 23:59:00', TRUE, 2),
(1, 'Ghi âm hội thoại', 'Ghi âm bài trang 20, nộp MP3', '2025-03-22 23:59:00', TRUE, 2),
(1, 'BT Từ vựng Chủ đề 2', 'Worksheet Công việc', '2025-04-05 23:59:00', FALSE, 2)
ON CONFLICT DO NOTHING;

INSERT INTO alert_rules (class_id, max_total_absences, max_consecutive_absences, max_missing_assignments) VALUES
(1, 3, 2, 2)
ON CONFLICT DO NOTHING;

INSERT INTO payments (student_id, class_id, amount, status, due_date, paid_at) VALUES
(4, 1, 3000000, 'PAID', '2025-01-15', '2025-01-14'),
(5, 1, 3000000, 'PAID', '2025-01-15', '2025-01-20'),
(6, 1, 3000000, 'PAID', '2025-01-15', '2025-01-13'),
(7, 1, 3000000, 'PENDING', '2025-03-01', NULL),
(8, 1, 3000000, 'PARTIAL', '2025-03-01', NULL)
ON CONFLICT DO NOTHING;
