CREATE TABLE IF NOT EXISTS pronunciation_exercises (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  pinyin TEXT,
  meaning TEXT,
  sample_audio_url TEXT,
  due_date TIMESTAMP,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pronunciation_submissions (
  id SERIAL PRIMARY KEY,
  exercise_id INT REFERENCES pronunciation_exercises(id) ON DELETE CASCADE,
  student_id INT REFERENCES users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_seconds INT,
  score NUMERIC(5,2),
  teacher_comment TEXT,
  status VARCHAR(20) DEFAULT 'SUBMITTED',
  submitted_at TIMESTAMP DEFAULT NOW(),
  graded_at TIMESTAMP,
  graded_by INT REFERENCES users(id),
  UNIQUE (exercise_id, student_id),
  CONSTRAINT pronunciation_submission_status_check CHECK (status IN ('SUBMITTED','GRADED','REVISION_REQUIRED'))
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_exercises_class ON pronunciation_exercises(class_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_submissions_exercise ON pronunciation_submissions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_submissions_student ON pronunciation_submissions(student_id);
