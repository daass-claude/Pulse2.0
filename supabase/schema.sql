-- ============================================================
-- PULSE 2.0 — SUPABASE SCHEMA
-- Paste this entire file into the Supabase SQL Editor and run.
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING.
-- ============================================================


-- ============================================================
-- 1. USERS TABLE
-- Stores all team members + persistent passwords.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  email      TEXT PRIMARY KEY,
  name       TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'employee')),
  tz         TEXT        NOT NULL DEFAULT 'PHT' CHECK (tz IN ('PHT', 'EST')),
  username   TEXT,
  password   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial team members — edit passwords here before running if needed
INSERT INTO public.users (email, name, role, tz, username, password) VALUES
  ('malka@pulse.app',        'Malka',        'admin',    'EST', NULL, 'malka123'),
  ('moshe@pulse.app',        'Moshe',        'admin',    'EST', NULL, 'moshe123'),
  ('julia@pulse.app',        'Julia',        'admin',    'PHT', NULL, 'julia123'),
  ('admin.guy@pulse.app',    'Admin Guy',    'admin',    'EST', '1',  '1'),
  ('christian@pulse.app',    'Christian',    'employee', 'PHT', NULL, 'christian123'),
  ('judy@pulse.app',         'Judy',         'employee', 'PHT', NULL, 'judy123'),
  ('sandra@pulse.app',       'Sandra',       'employee', 'PHT', NULL, 'sandra123'),
  ('gian@pulse.app',         'Gian',         'employee', 'PHT', NULL, 'gian123'),
  ('richard@pulse.app',      'Richard',      'employee', 'PHT', NULL, 'richard123'),
  ('employee.guy@pulse.app', 'Employee Guy', 'employee', 'PHT', '2',  '2')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_anon_all" ON public.users;
CREATE POLICY "users_anon_all" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;

-- RPC: check_password — used by AuthContext.login()
CREATE OR REPLACE FUNCTION public.check_password(p_email TEXT, p_password TEXT)
RETURNS TABLE(email TEXT, name TEXT, role TEXT, tz TEXT, username TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT u.email, u.name, u.role, u.tz, u.username
    FROM public.users u
    WHERE (u.email = p_email OR u.username = p_email)
      AND u.password = p_password;
END;
$$;

-- RPC: change_password — used by AuthContext.changePassword()
CREATE OR REPLACE FUNCTION public.change_password(
  p_email        TEXT,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
    SET password   = p_new_password,
        updated_at = NOW()
  WHERE email    = p_email
    AND password = p_old_password;
  RETURN FOUND;
END;
$$;


-- ============================================================
-- 2. LIVE STATUS TABLE
-- Real-time team presence. One row per user, upserted on change.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.live_status (
  email        TEXT        PRIMARY KEY,
  status       TEXT        NOT NULL DEFAULT 'Offline',
  current_task TEXT                 DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live_status_anon_all" ON public.live_status;
CREATE POLICY "live_status_anon_all" ON public.live_status FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_status TO anon, authenticated;

-- Required for Supabase Realtime to send full row payloads on changes
ALTER TABLE public.live_status REPLICA IDENTITY FULL;

-- Add to supabase_realtime publication so postgres_changes subscriptions fire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_status;
  END IF;
END $$;


-- ============================================================
-- 3. DAILY TASKS TABLE
-- In-progress session state synced every 30s. Recovered on page reload.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  email      TEXT        PRIMARY KEY,
  tasks      JSONB       NOT NULL DEFAULT '[]',
  loom_link  TEXT                 DEFAULT '',
  login_time TEXT                 DEFAULT '',
  is_lunch   BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_tasks_anon_all" ON public.daily_tasks;
CREATE POLICY "daily_tasks_anon_all" ON public.daily_tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_tasks TO anon, authenticated;


-- ============================================================
-- 4. EOD ENTRIES TABLE
-- Permanent record of every submitted End-of-Day report.
-- Unique per employee+date so duplicate submits upsert cleanly.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.eod_entries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT        NOT NULL,
  employee_name  TEXT        NOT NULL,
  date           TEXT        NOT NULL,
  tasks          JSONB       NOT NULL DEFAULT '[]',
  total_hours    TEXT,
  login_time     TEXT,
  logout_time    TEXT,
  loom_link      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_email, date)
);

ALTER TABLE public.eod_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eod_entries_anon_all" ON public.eod_entries;
CREATE POLICY "eod_entries_anon_all" ON public.eod_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eod_entries TO anon, authenticated;

-- Keep updated_at current on upsert
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS eod_entries_updated_at ON public.eod_entries;
CREATE TRIGGER eod_entries_updated_at
  BEFORE UPDATE ON public.eod_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. ROUTINE TASKS TABLE
-- Quick-start shortcuts per user. Unique per user+name.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.routine_tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, name)
);

ALTER TABLE public.routine_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routine_tasks_anon_all" ON public.routine_tasks;
CREATE POLICY "routine_tasks_anon_all" ON public.routine_tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_tasks TO anon, authenticated;


-- ============================================================
-- 6. SOD ENTRIES TABLE
-- Start-of-Day form submissions. One per user per day.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sod_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  date       TEXT        NOT NULL,
  priorities TEXT,
  gratitude  TEXT,
  quote      TEXT,
  tz         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, date)
);

ALTER TABLE public.sod_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sod_entries_anon_all" ON public.sod_entries;
CREATE POLICY "sod_entries_anon_all" ON public.sod_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sod_entries TO anon, authenticated;


-- ============================================================
-- 7. PROFILES TABLE
-- Stores compressed Base64 profile picture per user.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  email      TEXT        PRIMARY KEY,
  avatar     TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_anon_all" ON public.profiles;
CREATE POLICY "profiles_anon_all" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
