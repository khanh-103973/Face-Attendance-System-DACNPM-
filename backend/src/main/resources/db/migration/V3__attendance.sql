CREATE TABLE attendance_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL CHECK (length(trim(title)) > 0),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    late_after_minutes INTEGER NOT NULL CHECK (late_after_minutes BETWEEN 0 AND 180),
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (closed_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX uq_open_session_per_class ON attendance_sessions(class_id) WHERE closed_at IS NULL;
CREATE INDEX idx_sessions_class ON attendance_sessions(class_id, id);
CREATE TABLE attendance_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(10) NOT NULL CHECK (status IN ('PRESENT', 'LATE')),
    cosine DOUBLE PRECISION NOT NULL CHECK (cosine BETWEEN -1 AND 1),
    UNIQUE (session_id, student_id)
);
CREATE INDEX idx_attendance_records_student ON attendance_records(student_id);
