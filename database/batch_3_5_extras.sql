-- Batch 3-5 extras migration for existing databases.
-- Safe to run multiple times.

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
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);

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
