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
  last_seen_at  TEXT,                           -- student presence heartbeat
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

-- Enrolment requests from inscricao.html (admin tab: Inscrições)
CREATE TABLE IF NOT EXISTS enrollments (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  age             INTEGER,
  marital         TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  province        TEXT,
  municipality    TEXT,
  course          TEXT NOT NULL,
  level           TEXT,
  schedule        TEXT,
  motivation      TEXT,
  difficulties    TEXT,
  experience      TEXT,
  topics          TEXT,
  notes           TEXT,
  amount_kz       INTEGER NOT NULL DEFAULT 0,
  payment_method  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_created ON enrollments(created_at);

-- Product orders from checkout.html (admin tab: Encomendas)
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  province        TEXT,
  municipality    TEXT,
  notes           TEXT,
  items_json      TEXT NOT NULL,
  total_kz        INTEGER NOT NULL DEFAULT 0,
  payment_method  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- In-app notifications for students
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL DEFAULT 'info',  -- info | course | certificate | system
  link        TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);

-- Course completion certificates
CREATE TABLE IF NOT EXISTS certificates (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name  TEXT NOT NULL,
  course_title  TEXT NOT NULL,
  issued_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- Website CMS (texts PT+EN, images, course prices, products, contact)
-- One row per section; data_json holds the section payload.
CREATE TABLE IF NOT EXISTS site_content (
  section     TEXT PRIMARY KEY,               -- announce | hero | about | courses | products | contact | diff | images
  data_json   TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Contact form messages (admin tab: Mensagens)
CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',  -- new | read | done
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at);


-- Presence: online = last_seen_at within last 2 minutes
-- For existing DBs, also run once:
--   ALTER TABLE users ADD COLUMN last_seen_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);
