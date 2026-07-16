-- Safe to run on existing environments before deploying the age-adaptive student UI.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
