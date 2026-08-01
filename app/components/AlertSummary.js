// app/components/AlertSummary.js
// Feature 2: Smart Alert Summariser — Mobile widget
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const SEVERITY_STYLE = {
  safe:    { border: C.green, bg: 'rgba(34,197,94,0.08)',  icon: '✅', color: C.green, badgeBg: 'rgba(34,197,94,0.15)' },
  caution: { border: C.amber, bg: 'rgba(245,158,11,0.08)', icon: '⚠️', color: C.amber, badgeBg: 'rgba(245,158,11,0.15)' },
  unsafe:  { border: C.red,   bg: 'rgba(239,68,68,0.08)',  icon: '🚨', color: C.red,   badgeBg: 'rgba(239,68,68,0.15)' },
};

async function fetchAlerts() {
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*, nodes(location_name, campus, latitude, longitude)')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  return alerts || [];
}

async function generateSummary(alerts) {
  if (alerts.length === 0) {
    return {
      summary: 'All clear! No active alerts across any UJ campus. All nodes are reporting readings within SANS 241:2015 limits.',
      alertCount: 0,
      severity: 'safe',
      byStatus: { unsafe: 0, caution: 0 },
      byCampus: {},
    };
  }

  const alertData = alerts.map(a => ({
    parameter: a.parameter,
    value: a.value,
    threshold: a.threshold,
    status: a.sans_status,
    location: a.nodes?.location_name,
    campus: a.nodes?.campus,
    time: a.created_at,
  }));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a water quality monitoring AI for the University of Johannesburg.

Summarise these ${alerts.length} active SANS 241:2015 alerts in 2-3 sentences maximum.
Be specific about which campuses and parameters are affected.
If multiple alerts are on the same campus, group them.
Mention if there is a possible common cause.
End with a clear action recommendation.
Use plain English, no jargon.

Alert data:
${JSON.stringify(alertData, null, 2)}`,
      }],
    }),
  });

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content || 'Unable to generate summary.';
  const hasUnsafe = alerts.some(a => a.sans_status === 'UNSAFE');

  return {
    summary,
    alertCount: alerts.length,
    severity: hasUnsafe ? 'unsafe' : 'caution',
    byStatus: {
      unsafe:  alerts.filter(a => a.sans_status === 'UNSAFE').length,
      caution: alerts.filter(a => a.sans_status === 'CAUTION').length,
    },
    byCampus: alerts.reduce((acc, a) => {
      const campus = a.nodes?.campus || 'Unknown';
      acc[campus] = (acc[campus] || 0) + 1;
      return acc;
    }, {}),
  };
}

export default function AlertSummary() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const alerts = await fetchAlerts();
      const summary = await generateSummary(alerts);
      setData(summary);
      setUpdatedAt(new Date());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.card}>
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <View>
            <Text style={s.loadingTitle}>AquaAI is analysing alerts...</Text>
            <Text style={s.loadingSub}>Checking all campus nodes</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!data) return null;

  const style = SEVERITY_STYLE[data.severity];
  const campusEntries = Object.entries(data.byCampus || {});

  return (
    <View style={[s.card, { borderColor: style.border + '55' }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: style.bg }]}>
        <View style={s.headerRow}>
          <Text style={s.icon}>{style.icon}</Text>
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Text style={s.title}>AquaAI Alert Summary</Text>
              <View style={[s.badge, { backgroundColor: style.badgeBg, borderColor: style.border + '55' }]}>
                <Text style={[s.badgeTxt, { color: style.color }]}>
                  {data.alertCount} alert{data.alertCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <Text style={s.summaryTxt}>{data.summary}</Text>
          </View>
          <TouchableOpacity onPress={load} style={s.refreshBtn}>
            <Text style={s.refreshTxt}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats row */}
      {data.alertCount > 0 && (
        <View style={s.statsRow}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {data.byStatus.unsafe > 0 && (
              <View style={s.statItem}>
                <View style={[s.dot, { backgroundColor: C.red }]} />
                <Text style={[s.statTxt, { color: C.red }]}>{data.byStatus.unsafe} UNSAFE</Text>
              </View>
            )}
            {data.byStatus.caution > 0 && (
              <View style={s.statItem}>
                <View style={[s.dot, { backgroundColor: C.amber }]} />
                <Text style={[s.statTxt, { color: C.amber }]}>{data.byStatus.caution} CAUTION</Text>
              </View>
            )}
          </View>
          {campusEntries.length > 0 && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)}>
              <Text style={s.expandTxt}>{expanded ? 'Hide' : 'By campus'} {expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Campus breakdown */}
      {expanded && campusEntries.length > 0 && (
        <View style={s.campusGrid}>
          {campusEntries.map(([campus, count]) => (
            <View key={campus} style={s.campusItem}>
              <Text style={s.campusName}>{campus}</Text>
              <Text style={s.campusCount}>{count} alert{count !== 1 ? 's' : ''}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerTxt}>💧 Powered by AquaAI</Text>
        {updatedAt && <Text style={s.footerTxt}>Updated {updatedAt.toLocaleTimeString()}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  loadingTitle:{ fontSize: 13, fontWeight: '700', color: C.text0 },
  loadingSub:  { fontSize: 11, color: C.text2, marginTop: 2 },
  header:      { paddingHorizontal: 16, paddingVertical: 14 },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon:        { fontSize: 20, marginTop: 1 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  title:       { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeTxt:    { fontSize: 11, fontWeight: '700' },
  summaryTxt:  { fontSize: 13, color: C.text0, lineHeight: 19 },
  refreshBtn:  { padding: 2 },
  refreshTxt:  { fontSize: 16 },
  statsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  statItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  statTxt:     { fontSize: 11, fontWeight: '700' },
  expandTxt:   { fontSize: 11, color: C.blueLight, fontWeight: '700' },
  campusGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  campusItem:  { flexBasis: '47%', flexGrow: 1, backgroundColor: C.bg3, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  campusName:  { fontSize: 12, fontWeight: '600', color: C.text1 },
  campusCount: { fontSize: 11, fontWeight: '700', color: C.amber },
  footer:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.bg1, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerTxt:   { fontSize: 9, color: C.text2 },
});
