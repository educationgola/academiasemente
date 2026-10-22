-- Academia Semente — D1 schema
-- Run: npx wrangler d1 execute academiasemente-db --file=./schema.sql

PRAGMA foreign_keys = ON;

-- Students / public users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,               -- uuid
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,                           -- null if Google-only
  name          TEXT,
  picture       TEXT,
  google_id     TEXT UNIQUE,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | active | suspended
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);

-- Courses (a course groups private videos)
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  title_pt    TEXT NOT NULL,
  title_en    TEXT,
  description_pt TEXT,
  description_en TEXT,
  cover_url   TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Private videos (Cloudinary authenticated assets)
CREATE TABLE IF NOT EXISTS videos (
  id                    TEXT PRIMARY KEY,
  course_id             TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title_pt              TEXT NOT NULL,
  title_en              TEXT,
  description_pt        TEXT,
  cloudinary_public_id  TEXT NOT NULL,          -- e.g. academiasemente/private/lesson-01
  duration_seconds      INTEGER,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_course ON videos(course_id);

-- Staff grants a course to a student
CREATE TABLE IF NOT EXISTS user_courses (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active',    -- active | expired | revoked
  granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT,                             -- null = no expiry
  granted_by  TEXT,                             -- admin note
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_courses_user ON user_courses(user_id);

-- Simple session / refresh tracking (optional, for revocation)
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Student watch progress (resume + course %)
CREATE TABLE IF NOT EXISTS watch_progress (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id         TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  completed        INTEGER NOT NULL DEFAULT 0,  -- 0 | 1
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_progress_user ON watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_video ON watch_progress(video_id);
