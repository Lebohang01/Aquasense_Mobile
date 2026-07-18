-- backend/scripts/setup_webhooks.sql
-- Run in Supabase Studio → SQL Editor after deploying Edge Functions
-- This sets up pg_cron for daily aggregation scheduling

-- ── Enable pg_cron extension ──────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;  -- required for HTTP calls from pg_cron

-- ── Schedule daily aggregation at 22:00 UTC (00:00 SAST) ──
SELECT cron.schedule(
  'aquasense-daily-aggregation',  -- job name
  '0 22 * * *',                   -- cron expression: 22:00 UTC daily
  $$
    SELECT net.http_post(
      url     := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-aggregation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'aquasense-daily-aggregation';

-- ── Increment likes RPC (used by community posts) ─────
CREATE OR REPLACE FUNCTION increment_likes(post_id UUID)
RETURNS void AS $$
  UPDATE posts SET likes = likes + 1 WHERE id = post_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── View: latest reading per node (handy for dashboard) ─
CREATE OR REPLACE VIEW node_latest_readings AS
SELECT DISTINCT ON (node_id)
  r.node_id,
  r.ph,
  r.tds,
  r.turbidity,
  r.temperature,
  r.sans_status,
  r.created_at,
  n.campus,
  n.location_name,
  n.status AS node_status
FROM readings r
JOIN nodes n ON n.node_id = r.node_id
ORDER BY r.node_id, r.created_at DESC;

-- Grant select to authenticated users
GRANT SELECT ON node_latest_readings TO authenticated;

-- ── Helper: get nodes with active alert count ──────────
CREATE OR REPLACE VIEW node_alert_summary AS
SELECT
  n.node_id,
  n.campus,
  n.location_name,
  n.status,
  COUNT(a.id) FILTER (WHERE a.resolved_at IS NULL)                    AS active_alert_count,
  COUNT(a.id) FILTER (WHERE a.resolved_at IS NULL AND a.sans_status = 'UNSAFE') AS unsafe_count
FROM nodes n
LEFT JOIN alerts a ON a.node_id = n.node_id
GROUP BY n.node_id, n.campus, n.location_name, n.status;

GRANT SELECT ON node_alert_summary TO authenticated;
