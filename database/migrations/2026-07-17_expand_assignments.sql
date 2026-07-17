-- Detailed assignment configuration and multiple attachments.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS submission_type VARCHAR(10) NOT NULL DEFAULT 'BOTH',
  ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_submission_type_check;
ALTER TABLE assignments
  ADD CONSTRAINT assignments_submission_type_check
  CHECK (submission_type IN ('FILE', 'TEXT', 'BOTH'));

CREATE TABLE IF NOT EXISTS assignment_attachments (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment
  ON assignment_attachments(assignment_id);

CREATE TABLE IF NOT EXISTS submission_attachments (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission
  ON submission_attachments(submission_id);
