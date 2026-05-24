CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  enrollment_id INT REFERENCES enrollments(id) ON DELETE CASCADE,
  cert_number VARCHAR(50) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  issued_by INT REFERENCES users(id),
  final_score NUMERIC(5,2),
  classification VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_certificates_enrollment ON certificates(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_by ON certificates(issued_by);
