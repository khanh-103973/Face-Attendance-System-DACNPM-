CREATE TABLE students (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    CHECK (student_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'),
    CHECK (length(trim(full_name)) > 0)
);
CREATE TABLE classes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    CHECK (class_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'),
    CHECK (length(trim(name)) > 0)
);
CREATE TABLE class_students (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    UNIQUE (class_id, student_id)
);
CREATE INDEX idx_class_students_student ON class_students(student_id);
