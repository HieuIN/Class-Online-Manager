CREATE TABLE IF NOT EXISTS hanzi_sets (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hanzi_characters (
    id SERIAL PRIMARY KEY,
    set_id INTEGER NOT NULL REFERENCES hanzi_sets(id) ON DELETE CASCADE,
    character VARCHAR(8) NOT NULL,
    pinyin VARCHAR(100),
    meaning TEXT NOT NULL,
    note TEXT,
    example TEXT,
    stroke_gif_url TEXT,
    illustration_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hanzi_practice_progress (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES hanzi_characters(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learned BOOLEAN DEFAULT FALSE,
    completed BOOLEAN DEFAULT FALSE,
    mistakes INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (character_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_hanzi_sets_class ON hanzi_sets(class_id);
CREATE INDEX IF NOT EXISTS idx_hanzi_characters_set ON hanzi_characters(set_id, display_order);
CREATE INDEX IF NOT EXISTS idx_hanzi_progress_student ON hanzi_practice_progress(student_id);
