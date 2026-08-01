// app/components/DailyReport.js
// Feature 3: Auto-generated Daily Report — Mobile widget
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa', purple:'#a78bfa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const OVERALL_STYLE = {
  safe:    { bg: 'rgba(34,197,94,0.08)',  border: C.green, icon: '✅', badgeBg: 'rgba(34,197,94,0.15)' },
  caution: { bg: 'rgba(245,158,11,0.08)', border: C.amber, icon: '⚠️', badgeBg: 'rgba(245,158,11,0.15)' },
  unsafe:  { bg: 'rgba(239,68,68,0.08)',  border: C.red,   icon: '🚨', badgeBg: 'rgba(239,68,68,0.15)' },
};

const CAMPUS_LIST = ['UJ APK', 'UJ APB', 'UJ SWC', 'UJ DFC'];

async function fetchDayData() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: readings }, { data: alerts }] = await Promise.all([
    supabase.from('readings')
      .select('*, nodes(location_name, campus)')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false }),
    supabase.from('alerts')
      .select('*, nodes(location_name, campus)')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false }),
  ]);

  return { readings: readings || [], alerts: alerts || [] };
}

function computeCampusStats(readings, alerts) {
  const campusStats = {};

  CAMPUS_LIST.forEach(campus => {
    const campusReadings = readings.filter(r => r.nodes?.campus === campus);
    const campusAlerts   = alerts.filter(a => a.nodes?.campus === campus);

    if (campusReadings.length === 0) {
      campusStats[campus] = { readingCount: 0, alertCount: 0 };
      return;
    }

    const avg = (key) => {
      const vals = campusReadings.map(r => r[key]).filter(v => v != null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';
    };

    campusStats[campus] = {
      readingCount: campusReadings.length,
      alertCount: campusAlerts.length,
      avgPh: avg('ph'),
      avgTds: avg('tds'),
      avgTurbidity: avg('turbidity'),
      avgTemp: avg('temperature'),
    };
  });

  return campusStats;
}

async function generateReport() {
  const { readings, alerts } = await fetchDayData();
  const campusStats = computeCampusStats(readings, alerts);
  const totalReadings = readings.length;
  const totalAlerts   = alerts.length;
  const date = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are AquaAI for the University of Johannesburg water quality monitoring system.

Generate a professional but friendly daily water quality report for ${date}.

Data from the last 24 hours:
- Total readings: ${totalReadings}
- Total alerts: ${totalAlerts}
- Campus breakdown: ${JSON.stringify(campusStats, null, 2)}

SANS 241:2015 safe limits: pH 5.0-9.7, TDS ≤1200 mg/L, Turbidity ≤5 NTU, Temperature 5-25°C

Format the report as:
1. One opening sentence greeting (mention the date)
2. Overall campus health summary (1-2 sentences)
3. Campus-by-campus highlights (only mention campuses with data, 1 sentence each)
4. Any concerns or notable events
5. One closing recommendation

Keep it under 200 words. Use plain English. Be factual and helpful.`,
      }],
    }),
  });

  const data = await response.json();
  const report = data.choices?.[0]?.message?.content || 'Unable to generate daily report.';
  const overall = totalAlerts === 0 ? 'safe' : alerts.some(a => a.sans_status === 'UNSAFE') ? 'unsafe' : 'caution';

  return { report, date, stats: { totalReadings, totalAlerts, campusStats }, overall };
}

export default function DailyReport() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showStats, setShowStats] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await generateReport();
      setData(result);
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
            <Text style={s.loadingTitle}>Generating daily report...</Text>
            <Text style={s.loadingSub}>AquaAI is analysing 24h of data</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!data) return null;

  const style = OVERALL_STYLE[data.overall];
  const campusEntries = Object.entries(data.stats.campusStats || {});

  return (
    <View style={[s.card, { borderColor: style.border + '55' }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: style.bg }]}>
        <View style={s.headerLeft}>
          <Text style={s.icon}>{style.icon}</Text>
          <View>
            <Text style={s.title}>AquaAI Daily Report</Text>
            <Text style={s.date}>{data.date}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <View style={[s.badge, { backgroundColor: style.badgeBg, borderColor: style.border + '55' }]}>
            <Text style={[s.badgeTxt, { color: style.border }]}>{data.overall.toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={load} style={{ padding: 2 }}>
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Report text */}
      <View style={s.reportBody}>
        <Text style={s.reportTxt}>{data.report}</Text>
      </View>

      {/* Quick stats */}
      <View style={s.statsGrid}>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: C.blueLight }]}>{data.stats.totalReadings}</Text>
          <Text style={s.statLabel}>Readings</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: data.stats.totalAlerts > 0 ? C.amber : C.green }]}>{data.stats.totalAlerts}</Text>
          <Text style={s.statLabel}>Alerts</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: C.purple }]}>4</Text>
          <Text style={s.statLabel}>Campuses</Text>
        </View>
      </View>

      {/* Campus detail toggle */}
      {campusEntries.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowStats(!showStats)} style={s.toggleBtn}>
            <Text style={s.toggleTxt}>{showStats ? '▲ Hide' : '▼ Show'} campus breakdown</Text>
          </TouchableOpacity>

          {showStats && (
            <View style={s.campusList}>
              {campusEntries.map(([campus, stats]) => (
                <View key={campus} style={s.campusCard}>
                  <View style={s.campusHeader}>
                    <Text style={s.campusName}>{campus}</Text>
                    {stats.readingCount > 0 ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Text style={s.campusMeta}>{stats.readingCount} readings</Text>
                        {stats.alertCount > 0 && <Text style={s.campusAlert}>{stats.alertCount} alerts</Text>}
                      </View>
                    ) : (
                      <Text style={s.campusMeta}>No data</Text>
                    )}
                  </View>
                  {stats.readingCount > 0 && (
                    <View style={s.metricRow}>
                      {[
                        { label: 'pH',   val: stats.avgPh },
                        { label: 'TDS',  val: stats.avgTds !== 'N/A' ? Math.round(stats.avgTds) : 'N/A' },
                        { label: 'Turb', val: stats.avgTurbidity },
                        { label: 'Temp', val: stats.avgTemp !== 'N/A' ? `${stats.avgTemp}°` : 'N/A' },
                      ].map(m => (
                        <View key={m.label} style={s.metricBox}>
                          <Text style={s.metricVal}>{m.val}</Text>
                          <Text style={s.metricLabel}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={s.footer}>
        <Text style={s.footerTxt}>💧 Generated by AquaAI · Based on last 24 hours of sensor data</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  loadingTitle:{ fontSize: 13, fontWeight: '700', color: C.text0 },
  loadingSub:  { fontSize: 11, color: C.text2, marginTop: 2 },
  header:      { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon:        { fontSize: 18 },
  title:       { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  date:        { fontSize: 13, fontWeight: '700', color: C.text0, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:       { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeTxt:    { fontSize: 10, fontWeight: '700' },
  reportBody:  { paddingHorizontal: 16, paddingVertical: 14 },
  reportTxt:   { fontSize: 13, color: C.text0, lineHeight: 19 },
  statsGrid:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  statBox:     { flex: 1, backgroundColor: C.bg3, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statNum:     { fontSize: 17, fontWeight: '700' },
  statLabel:   { fontSize: 9, color: C.text2, marginTop: 3 },
  toggleBtn:   { paddingHorizontal: 16, paddingBottom: 12 },
  toggleTxt:   { fontSize: 11, color: C.blueLight, fontWeight: '700' },
  campusList:  { paddingHorizontal: 16, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  campusCard:  { backgroundColor: C.bg3, borderRadius: 12, padding: 10 },
  campusHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  campusName:  { fontSize: 13, fontWeight: '700', color: C.text0 },
  campusMeta:  { fontSize: 10, color: C.text2 },
  campusAlert: { fontSize: 10, fontWeight: '700', color: C.amber },
  metricRow:   { flexDirection: 'row', gap: 6 },
  metricBox:   { flex: 1, backgroundColor: C.bg2, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  metricVal:   { fontSize: 11, fontWeight: '700', color: C.text0 },
  metricLabel: { fontSize: 8, color: C.text2, marginTop: 1 },
  footer:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.bg1, borderTopWidth: 1, borderTopColor: C.border },
  footerTxt:   { fontSize: 9, color: C.text2 },
});
