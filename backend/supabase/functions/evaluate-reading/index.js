// backend/supabase/functions/evaluate-reading/index.js
// Supabase Edge Function — Deno runtime
// Triggered by: Database Webhook on INSERT to readings table
// Purpose: Evaluate SANS 241 thresholds → create alert if CAUTION/UNSAFE

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SANS 241:2015 thresholds
const LIMITS = {
  ph:          { min: 5.0,  max: 9.7  },
  tds:         { max: 1200 },               // mg/L
  turbidity:   { max: 5    },               // NTU
  temperature: { min: 5.0,  max: 25.0 },
};

const UNSAFE_LIMITS = {
  ph:        { min: 4.0, max: 11.0 },
  tds:       { max: 2400 },
  turbidity: { max: 10  },
};

function evaluateSANS(record) {
  const issues = [];

  // pH
  if (record.ph < LIMITS.ph.min || record.ph > LIMITS.ph.max) {
    issues.push({ parameter: 'ph', value: record.ph, threshold: record.ph < LIMITS.ph.min ? LIMITS.ph.min : LIMITS.ph.max });
  }
  // TDS
  if (record.tds > LIMITS.tds.max) {
    issues.push({ parameter: 'tds', value: record.tds, threshold: LIMITS.tds.max });
  }
  // Turbidity
  if (record.turbidity > LIMITS.turbidity.max) {
    issues.push({ parameter: 'turbidity', value: record.turbidity, threshold: LIMITS.turbidity.max });
  }
  // Temperature
  if (record.temperature < LIMITS.temperature.min || record.temperature > LIMITS.temperature.max) {
    issues.push({ parameter: 'temperature', value: record.temperature, threshold: record.temperature < LIMITS.temperature.min ? LIMITS.temperature.min : LIMITS.temperature.max });
  }

  // Determine severity
  const isUnsafe =
    record.ph < UNSAFE_LIMITS.ph.min ||
    record.ph > UNSAFE_LIMITS.ph.max ||
    record.tds > UNSAFE_LIMITS.tds.max ||
    record.turbidity > UNSAFE_LIMITS.turbidity.max;

  const status = issues.length === 0 ? 'SAFE' : isUnsafe ? 'UNSAFE' : 'CAUTION';
  return { status, issues };
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record || !record.node_id) {
      return new Response('Invalid payload', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    const { status, issues } = evaluateSANS(record);

    // If not safe — create alerts for each failing parameter
    if (status !== 'SAFE') {
      const alertRows = issues.map(issue => ({
        node_id:     record.node_id,
        reading_id:  record.id,
        parameter:   issue.parameter,
        value:       issue.value,
        threshold:   issue.threshold,
        sans_status: status,
      }));

      const { error: alertErr } = await supabase
        .from('alerts')
        .insert(alertRows);

      if (alertErr) {
        console.error('[evaluate-reading] Alert insert error:', alertErr.message);
      }

      // Update the reading's sans_status if it differs (ESP32 may have evaluated differently)
      await supabase
        .from('readings')
        .update({ sans_status: status })
        .eq('id', record.id);

      console.log(`[evaluate-reading] ${status} — ${issues.length} issue(s) for node ${record.node_id}`);
    } else {
      console.log(`[evaluate-reading] SAFE reading for node ${record.node_id}`);
    }

    // Update node last_seen + status
    await supabase
      .from('nodes')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online',
      })
      .eq('node_id', record.node_id);

    return new Response(JSON.stringify({ ok: true, status }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[evaluate-reading] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
