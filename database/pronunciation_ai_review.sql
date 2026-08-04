ALTER TABLE pronunciation_exercises ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE pronunciation_exercises ADD COLUMN IF NOT EXISTS accent VARCHAR(20) NOT NULL DEFAULT 'zh-CN';
ALTER TABLE pronunciation_exercises ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3;
ALTER TABLE pronunciation_exercises ADD COLUMN IF NOT EXISTS pass_score NUMERIC(5,2) NOT NULL DEFAULT 7;

ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS ai_score NUMERIC(5,2);
ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS ai_breakdown JSONB;
ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP;
ALTER TABLE pronunciation_submissions ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1;
