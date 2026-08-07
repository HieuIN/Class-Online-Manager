ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS zoom_require_auth boolean NOT NULL DEFAULT false;
