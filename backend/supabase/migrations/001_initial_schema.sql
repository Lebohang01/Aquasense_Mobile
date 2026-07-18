-- backend/supabase/migrations/001_initial_schema.sql
-- AquaSense UJ — Complete Supabase Schema
-- Run via: supabase db push  OR paste into Supabase Studio → SQL Editor

-- ── Extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- for daily aggregation scheduling

-- ── nodes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nodes (
  node_id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  campus          TEXT        NOT NULL,           -- e.g. 'APK', 'DFC', 'SWC', 'Doornfontein'
  location_name   TEXT        NOT NULL,           -- e.g. 'Library Entrance Fountain'
  latitude        FLOAT,
  longitude       FLOAT,
  status          TEXT        NOT NULL DEFAULT 'offline'
                              CHECK (status IN ('online','offline','maintenance')),
  last_seen       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── readings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readings (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id         UUID        NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
  ph              FLOAT       NOT NULL,
  tds             FLOAT       NOT NULL,
  turbidity       FLOAT       NOT NULL,
  temperature     FLOAT       NOT NULL,
  sans_status     TEXT        NOT NULL
                              CHECK (sans_status IN ('SAFE','CAUTION','UNSAFE')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_readings_node_time
  ON readings (node_id, created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_readings_status
  ON readings (sans_status, created_at DESC);

-- ── alerts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id         UUID        NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
  reading_id      UUID        REFERENCES readings(id) ON DELETE SET NULL,
  parameter       TEXT        NOT NULL,   -- 'ph' | 'tds' | 'turbidity' | 'temperature'
  value           FLOAT       NOT NULL,
  threshold       FLOAT       NOT NULL,
  sans_status     TEXT        NOT NULL CHECK (sans_status IN ('CAUTION','UNSAFE')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_node
  ON alerts (node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_unresolved
  ON alerts (resolved_at) WHERE resolved_at IS NULL;

-- ── users ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  campus_preference TEXT,       -- which campus they primarily care about
  push_token        TEXT,       -- Expo push notification token
  role              TEXT        NOT NULL DEFAULT 'student'
                                CHECK (role IN ('student','admin','technician')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── reports (student-submitted water issues) ──────────
CREATE TABLE IF NOT EXISTS reports (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  node_id         UUID        REFERENCES nodes(node_id) ON DELETE CASCADE,
  issue_type      TEXT        NOT NULL,   -- 'taste','odour','colour','pressure','other'
  description     TEXT,
  image_url       TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','investigating','resolved')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── readings_daily (aggregated for charts/history) ────
CREATE TABLE IF NOT EXISTS readings_daily (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id         UUID        NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  avg_ph          FLOAT,
  avg_tds         FLOAT,
  avg_turbidity   FLOAT,
  avg_temperature FLOAT,
  min_sans_status TEXT        CHECK (min_sans_status IN ('SAFE','CAUTION','UNSAFE')),
  reading_count   INTEGER     DEFAULT 0,
  UNIQUE (node_id, date)
);

-- ── Row Level Security ─────────────────────────────────
ALTER TABLE nodes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings_daily ENABLE ROW LEVEL SECURITY;

-- nodes: anyone authenticated can read; only admins/service role write
CREATE POLICY "nodes_select" ON nodes
  FOR SELECT USING (auth.role() = 'authenticated');

-- readings: authenticated can read
CREATE POLICY "readings_select" ON readings
  FOR SELECT USING (auth.role() = 'authenticated');
-- Service role (ESP32 via anon key with RLS bypass) inserts via Edge Function
-- OR allow anon insert for firmware posts (choose one):
CREATE POLICY "readings_insert_anon" ON readings
  FOR INSERT WITH CHECK (true); -- firmware uses anon key; restrict per node_id in production

-- alerts: authenticated can read
CREATE POLICY "alerts_select" ON alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- users: own profile only
CREATE POLICY "users_own" ON users
  FOR ALL USING (auth.uid() = id);

-- reports: authenticated can insert, read own; admins read all
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (auth.uid() = user_id);

-- readings_daily: authenticated can read
CREATE POLICY "readings_daily_select" ON readings_daily
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── Realtime subscriptions ─────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE readings;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;

-- ── Aggregate function (called by daily-aggregation Edge Function) ──
CREATE OR REPLACE FUNCTION aggregate_daily_readings(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO readings_daily (node_id, date, avg_ph, avg_tds, avg_turbidity, avg_temperature, min_sans_status, reading_count)
  SELECT
    node_id,
    target_date                          AS date,
    ROUND(AVG(ph)::NUMERIC, 2)           AS avg_ph,
    ROUND(AVG(tds)::NUMERIC, 1)          AS avg_tds,
    ROUND(AVG(turbidity)::NUMERIC, 2)    AS avg_turbidity,
    ROUND(AVG(temperature)::NUMERIC, 2)  AS avg_temperature,
    CASE
      WHEN 'UNSAFE'  = ANY(ARRAY_AGG(DISTINCT sans_status)) THEN 'UNSAFE'
      WHEN 'CAUTION' = ANY(ARRAY_AGG(DISTINCT sans_status)) THEN 'CAUTION'
      ELSE 'SAFE'
    END                                  AS min_sans_status,
    COUNT(*)                             AS reading_count
  FROM readings
  WHERE created_at::DATE = target_date
  GROUP BY node_id
  ON CONFLICT (node_id, date) DO UPDATE SET
    avg_ph          = EXCLUDED.avg_ph,
    avg_tds         = EXCLUDED.avg_tds,
    avg_turbidity   = EXCLUDED.avg_turbidity,
    avg_temperature = EXCLUDED.avg_temperature,
    min_sans_status = EXCLUDED.min_sans_status,
    reading_count   = EXCLUDED.reading_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Seed: UJ campus nodes ──────────────────────────────
INSERT INTO nodes (node_id, campus, location_name, latitude, longitude, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'APK',          'Library Entrance Fountain',    -26.1849, 28.0002, 'online'),
  ('22222222-2222-2222-2222-222222222222', 'APK',          'Science Block Drinking Tap',   -26.1851, 28.0007, 'online'),
  ('33333333-3333-3333-3333-333333333333', 'DFC',          'Main Building Water Point',    -26.2041, 28.0326, 'online'),
  ('44444444-4444-4444-4444-444444444444', 'SWC',          'Student Centre Fountain',      -26.2634, 27.8497, 'offline'),
  ('55555555-5555-5555-5555-555555555555', 'Doornfontein', 'Engineering Lab Water Point',  -26.1988, 28.0465, 'online')
ON CONFLICT (node_id) DO NOTHING;
