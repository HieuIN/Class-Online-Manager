-- New accounts and admin password resets require a personal password at the next login.
-- Existing accounts remain unaffected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
