-- Initial schema for the learning platform.
-- Constraints live in the database as well as in the API layer so that
-- invariants hold even if a bug slips past application validation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness for email addresses.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description   TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  category      TEXT NOT NULL CHECK (char_length(category) BETWEEN 2 AND 50),
  level         TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  thumbnail_url TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX courses_published_idx ON courses (is_published, created_at DESC);
CREATE INDEX courses_category_idx ON courses (category);

CREATE TABLE lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  video_url        TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  position         INTEGER NOT NULL CHECK (position >= 1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Deferrable so lessons can be reordered inside a single transaction.
  CONSTRAINT lessons_course_position_key UNIQUE (course_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE enrollments (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, course_id)
);
CREATE INDEX enrollments_course_idx ON enrollments (course_id);

CREATE TABLE lesson_progress (
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id             UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  last_position_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  completed             BOOLEAN NOT NULL DEFAULT false,
  completed_at          TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id),
  CHECK ((completed AND completed_at IS NOT NULL) OR (NOT completed AND completed_at IS NULL))
);
CREATE INDEX lesson_progress_lesson_idx ON lesson_progress (lesson_id);
CREATE INDEX lesson_progress_user_updated_idx ON lesson_progress (user_id, updated_at DESC);
