CREATE TABLE IF NOT EXISTS ai_agent_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20),
  page_path VARCHAR(255),
  class_id INT REFERENCES classes(id) ON DELETE SET NULL,
  user_message TEXT NOT NULL,
  assistant_reply TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_logs_user_created ON ai_agent_logs(user_id,created_at DESC);
