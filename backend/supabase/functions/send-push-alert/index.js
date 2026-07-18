// backend/supabase/functions/send-push-alert/index.js
// Supabase Edge Function — Deno runtime
// Triggered by: Database Webhook on INSERT to alerts table
// Purpose: Send Expo Push Notifications to subscribed students

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const PARAMETER_LABELS = {
  ph:          'pH level',
  tds:         'TDS (dissolved solids)',
  turbidity:   'Turbidity (water clarity)',
  temperature: 'Water temperature',
};

const STATUS_EMOJI = {
  CAUTION: '⚠️',
  UNSAFE:  '🚨',
};

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

    // Get node info (campus + location name)
    const { data: node, error: nodeErr } = await supabase
      .from('nodes')
      .select('campus, location_name')
      .eq('node_id', record.node_id)
      .single();

    if (nodeErr || !node) {
      console.error('[send-push-alert] Node not found:', record.node_id);
      return new Response('Node not found', { status: 404 });
    }

    // Get all users on this campus who have push tokens
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('push_token')
      .eq('campus_preference', node.campus)
      .not('push_token', 'is', null);

    if (userErr) {
      console.error('[send-push-alert] User fetch error:', userErr.message);
    }

    const tokens = (users || [])
      .map(u => u.push_token)
      .filter(t => t && t.startsWith('ExponentPushToken['));

    if (tokens.length === 0) {
      console.log('[send-push-alert] No push tokens for campus:', node.campus);
      return new Response(JSON.stringify({ ok: true, sent: 0 }));
    }

    const paramLabel = PARAMETER_LABELS[record.parameter] || record.parameter;
    const emoji      = STATUS_EMOJI[record.sans_status] || '⚠️';
    const unit       = { ph: '', tds: ' mg/L', turbidity: ' NTU', temperature: '°C' }[record.parameter] || '';

    const messages = tokens.map(token => ({
      to:    token,
      sound: record.sans_status === 'UNSAFE' ? 'default' : null,
      title: `${emoji} Water ${record.sans_status === 'UNSAFE' ? 'UNSAFE' : 'Caution'} — ${node.campus}`,
      body:  `${node.location_name}: ${paramLabel} is ${record.value}${unit} (limit: ${record.threshold}${unit})`,
      data:  {
        nodeId:    record.node_id,
        alertId:   record.id,
        parameter: record.parameter,
        status:    record.sans_status,
      },
      priority: record.sans_status === 'UNSAFE' ? 'high' : 'normal',
      badge: 1,
    }));

    // Expo Push API accepts up to 100 messages per request — chunk if needed
    const CHUNK_SIZE = 100;
    let totalSent = 0;

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const resp = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    JSON.stringify(chunk),
      });

      const result = await resp.json();
      console.log(`[send-push-alert] Chunk ${Math.floor(i/CHUNK_SIZE)+1}: sent ${chunk.length} notifications`);

      // Log any invalid tokens for cleanup
      if (result.data) {
        result.data.forEach((item, idx) => {
          if (item.status === 'error' && item.details?.error === 'DeviceNotRegistered') {
            console.warn('[send-push-alert] Invalid token to clean up:', tokens[i + idx]);
            // In production: remove invalid tokens from users table
          }
        });
      }

      totalSent += chunk.length;
    }

    console.log(`[send-push-alert] Total sent: ${totalSent} to campus ${node.campus}`);
    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-push-alert] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
