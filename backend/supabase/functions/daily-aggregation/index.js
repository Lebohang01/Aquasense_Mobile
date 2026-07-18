// backend/supabase/functions/daily-aggregation/index.js
// Supabase Edge Function — Deno runtime
// Scheduled via Supabase cron (pg_cron) — runs daily at 00:00 SAST (22:00 UTC)
// Purpose: Aggregate previous day's readings into readings_daily table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Aggregate yesterday's readings
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[daily-aggregation] Aggregating readings for ${dateStr}`);

    const { data, error } = await supabase
      .rpc('aggregate_daily_readings', { target_date: dateStr });

    if (error) {
      console.error('[daily-aggregation] RPC error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // Also mark nodes offline if last_seen > 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { error: offlineErr } = await supabase
      .from('nodes')
      .update({ status: 'offline' })
      .lt('last_seen', oneHourAgo)
      .eq('status', 'online');

    if (offlineErr) {
      console.warn('[daily-aggregation] Offline update warning:', offlineErr.message);
    }

    console.log(`[daily-aggregation] Complete for ${dateStr}`);
    return new Response(JSON.stringify({ ok: true, date: dateStr }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[daily-aggregation] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
