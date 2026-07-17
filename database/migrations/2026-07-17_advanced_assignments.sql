-- Advanced assignment workflow: drafts, rubrics, templates, groups, versions and annotations.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_group_assignment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS group_max_members SMALLINT;

ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE assignments
  ADD CONSTRAINT assignments_status_check CHECK (status IN ('DRAFT', 'PUBLISHED'));

CREATE TABLE IF NOT EXISTS assignment_rubrics (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  criterion VARCHAR(255) NOT NULL,
  description TEXT,
  max_points NUMERIC(5,2) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (max_points > 0)
);
CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_assignment ON assignment_rubrics(assignment_id, display_order);

CREATE TABLE IF NOT EXISTS assignment_templates (
  id SERIAL PRIMARY KEY,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_author ON assignment_templates(created_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS assignment_groups (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (assignment_id, name)
);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_assignment ON assignment_groups(assignment_id);

CREATE TABLE IF NOT EXISTS assignment_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES assignment_groups(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (group_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_group_members_student ON assignment_group_members(student_id);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES assignment_groups(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_assignment_group
  ON submissions(assignment_id, group_id) WHERE group_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS submission_versions (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  group_id INTEGER REFERENCES assignment_groups(id) ON DELETE SET NULL,
  content_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC(5,2),
  teacher_comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (submission_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_submission_versions_submission ON submission_versions(submission_id, version_no DESC);

CREATE TABLE IF NOT EXISTS submission_rubric_scores (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  rubric_id INTEGER NOT NULL REFERENCES assignment_rubrics(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (submission_id, rubric_id)
);
CREATE INDEX IF NOT EXISTS idx_submission_rubric_scores_submission ON submission_rubric_scores(submission_id);

CREATE TABLE IF NOT EXISTS submission_annotations (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  attachment_id INTEGER REFERENCES submission_attachments(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_no INTEGER,
  position_x NUMERIC(7,4),
  position_y NUMERIC(7,4),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_submission_annotations_submission ON submission_annotations(submission_id, attachment_id, created_at);
