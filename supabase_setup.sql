-- ============================================================
--  Pulse 2.0 — Supabase Database Setup
--  Run this once in Supabase SQL Editor (Dashboard → SQL Editor)
--  Safe to re-run: CREATE TABLE uses IF NOT EXISTS.
--  For ALTER TABLE statements, run only once on existing DBs.
-- ============================================================


-- ── 1. EOD ENTRIES ───────────────────────────────────────────
--  One row per employee per calendar day.
--  Written by: EODContext.tsx → submitEOD() (upsert on employee_email+date)
--  Read by:    EODContext.tsx on mount (select *), EodsPayroll, ArchiveFiles
--  Note: UNIQUE(employee_email, date) prevents duplicate submissions for same day.
CREATE TABLE IF NOT EXISTS eod_entries (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name  text        NOT NULL,
  employee_email text        NOT NULL,
  date           text        NOT NULL,   -- e.g. "Mon, May 09"
  login_time     text,
  logout_time    text,
  total_hours    text,                   -- e.g. "07:32"
  loom_link      text,
  tasks          jsonb       DEFAULT '[]',
  created_at     timestamptz DEFAULT now(),
  UNIQUE(employee_email, date)
);

-- Add constraint to existing table (safe to run if already created without it)
ALTER TABLE eod_entries ADD CONSTRAINT eod_entries_employee_email_date_key
  UNIQUE (employee_email, date)
  DEFERRABLE INITIALLY IMMEDIATE;


-- ── 2. LIVE STATUS ────────────────────────────────────────────
--  One row per employee — current work status in real time.
--  Written by: Dashboard.tsx → pushLiveStatus() (upsert on email)
--             Only writes when status or current task name changes.
--  Read by:    Team.tsx — initial select + realtime subscription
CREATE TABLE IF NOT EXISTS live_status (
  email        text        PRIMARY KEY,
  status       text        DEFAULT 'Offline',  -- 'Working' | 'Lunch' | 'Offline'
  current_task text        DEFAULT '',
  updated_at   timestamptz DEFAULT now()
);


-- ── 3. SOD ENTRIES ────────────────────────────────────────────
--  One row per employee per calendar day.
--  Written by: SODModal.tsx on every login (upsert on email+date)
--  Read by:    Profile page (priorities + gratitude display via localStorage)
--  Note: UNIQUE(email, date) allows re-submitting SOD to update same day.
CREATE TABLE IF NOT EXISTS sod_entries (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email             text        NOT NULL,
  date              text        NOT NULL,   -- getDailyDateKey() format
  priorities        text,
  expected_outcomes text,
  gratitude         text,
  quote             text,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(email, date)
);


-- ── 4. DAILY TASKS ────────────────────────────────────────────
--  One row per employee — live session backup, overwritten continuously.
--  Written by: Dashboard.tsx → syncDailyNow() every 30s + on key events
--             (add task, remove task, lunch, resume, routine start)
--  Read by:    Dashboard.tsx on mount — restores tasks if localStorage is empty
--             (e.g. after browser cache clear or crash)
--  Cleared by: Dashboard.tsx → handleEndWork() deletes the row after EOD submit
--  Columns:
--    tasks      — full task array (status, elapsed time, notes, links)
--    loom_link  — today's Loom URL
--    login_time — when the employee logged in today
--    is_lunch   — whether currently on break
CREATE TABLE IF NOT EXISTS daily_tasks (
  email      text        PRIMARY KEY,
  tasks      jsonb       DEFAULT '[]',
  loom_link  text        DEFAULT '',
  login_time text        DEFAULT '',
  is_lunch   boolean     DEFAULT false,
  updated_at timestamptz DEFAULT now()
);


-- ── 5. ROUTINE TASKS ──────────────────────────────────────────
--  Saved quick-start shortcuts per user — persists across sessions.
--  Written by: Dashboard.tsx → addRoutine() insert, removeRoutine() delete
--  Read by:    Dashboard.tsx on mount — merges with localStorage list
--  Note: UNIQUE(user_email, name) prevents duplicate shortcut names per user.
CREATE TABLE IF NOT EXISTS routine_tasks (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text        NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_email, name)
);


-- ── SECURITY ──────────────────────────────────────────────────
--  RLS disabled — internal app, anon key access is intentional.
ALTER TABLE eod_entries   DISABLE ROW LEVEL SECURITY;
ALTER TABLE live_status   DISABLE ROW LEVEL SECURITY;
ALTER TABLE sod_entries   DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks   DISABLE ROW LEVEL SECURITY;
ALTER TABLE routine_tasks DISABLE ROW LEVEL SECURITY;


-- ── REALTIME ──────────────────────────────────────────────────
--  Only live_status needs realtime — Team page subscribes to it.
--  daily_tasks does NOT need realtime (single-user row, polled via interval).
ALTER PUBLICATION supabase_realtime ADD TABLE live_status;


-- ============================================================
--  CLEANUP: Remove test/removed users from all tables.
--  Run this block once after initial setup if needed.
-- ============================================================
DELETE FROM eod_entries   WHERE employee_email IN ('aldrich@pulse.app', 'arielle@pulse.app');
DELETE FROM live_status   WHERE email           IN ('aldrich@pulse.app', 'arielle@pulse.app');
DELETE FROM sod_entries   WHERE email           IN ('aldrich@pulse.app', 'arielle@pulse.app');
DELETE FROM daily_tasks   WHERE email           IN ('aldrich@pulse.app', 'arielle@pulse.app');
DELETE FROM routine_tasks WHERE user_email      IN ('aldrich@pulse.app', 'arielle@pulse.app');
