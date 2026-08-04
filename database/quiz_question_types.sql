ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_correct_answer_check;
ALTER TABLE quiz_questions ALTER COLUMN correct_answer TYPE TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(40) DEFAULT 'SINGLE_CHOICE';
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS explanation TEXT;

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS needs_manual_grading BOOLEAN DEFAULT FALSE;
