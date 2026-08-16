// app/components/NodeAnomalyInsight.js
// Trust & data quality: predictive anomaly narrative
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  bg2: '#151c30', bg3: '#1c2540',
  blue: '#3b82f6', blueLight: '#60a5fa',
  green: '#22c55e', red: '#ef4444', amber: '#f59e0b',
  text0: '#f1f5f9', text1: '#94a3b8', text2: '#475569',
  border: '#1e2d47',
};

async function fetchWeekReadings(nodeId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('readings')
    .select('ph, tds, turbidity, temperature, sans_status, created_at')
    .eq('node_id', nodeId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: true });
  return data || [];
}

async function generateInsight(nodeId, locationName) {
  const readings = await fetchWeekReadings(nodeId);

  if (readings.length < 3) {
    return { insight: 'Not enough readings yet this week to spot a trend.', hasFlag: false };
  }

  const summarised = readings.map(r => ({
    date: r.created_at?.slice(0, 10),
    ph: r.ph, tds: r.tds, turbidity: r.turbidity, temp: r.temperature, status: r.sans_status,
  }));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a water quality monitoring AI analysing a 7-day trend for "${locationName}".

Readings this week (oldest to newest):
${JSON.stringify(summarised, null, 2)}

Look for a developing pattern — a parameter drifting toward an unsafe range,
increasing volatility, or a slow decline — even if no single reading has
breached a threshold yet. If nothing concerning stands out, say so plainly
and briefly.

Respond in 1-2 sentences, plain English, no jargon. Start with either
"⚠️ " if there's a concerning trend, or "✅ " if things look stable.`,
      }],
    }),
  });

  const data = await response.json();
  const insight = data.choices?.[0]?.message?.content || 'Unable to generate trend insight.';
  const hasFlag = insight.trim().startsWith('⚠️');

  return { insight, hasFlag };
}

export default function NodeAnomalyInsight({ nodeId, locationName }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await generateInsight(nodeId, locationName);
      setResult(res);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [nodeId, locationName]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.card}>
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <Text style={s.loadingTxt}>Analysing 7-day trend...</Text>
        </View>
      </View>
    );
  }

  if (!result) return null;

  return (
    <View style={[s.card, result.hasFlag && s.cardFlagged]}>
      <View style={s.header}>
        <Text style={s.title}>7-Day Trend Insight</Text>
        <TouchableOpacity onPress={load}><Text style={{ fontSize: 14 }}>🔄</Text></TouchableOpacity>
      </View>
      <Text style={s.insightTxt}>{result.insight}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  cardFlagged: { borderColor: C.amber + '55', backgroundColor: 'rgba(245,158,11,0.06)' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingTxt:  { fontSize: 12, color: C.text1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title:       { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightTxt:  { fontSize: 13, color: C.text0, lineHeight: 19 },
});
