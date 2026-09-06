// app/components/NodeAnomalyInsight.js
// Trust & data quality: predictive anomaly narrative (Premium feature)
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getSubscriptionStatus } from '@/lib/subscription';

const C = {
  bg2: '#151c30', bg3: '#1c2540',
  blue: '#3b82f6', blueLight: '#60a5fa', purple: '#a78bfa',
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
      model: 'openai/gpt-oss-120b',
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
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(null); // null = still checking

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getSubscriptionStatus();
      setIsPremium(status.isPremium);

      if (!status.isPremium) {
        setLoading(false);
        return; // don't waste a Groq call if they can't see the result
      }

      const res = await generateInsight(nodeId, locationName);
      setResult(res);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [nodeId, locationName]);

  useEffect(() => { load(); }, [load]);

  if (loading || isPremium === null) {
    return (
      <View style={s.card}>
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <Text style={s.loadingTxt}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Locked state — free tier sees a teaser, not the actual insight
  if (!isPremium) {
    return (
      <View style={[s.card, s.cardLocked]}>
        <View style={s.header}>
          <Text style={s.title}>7-Day Trend Insight</Text>
          <Text style={s.premiumBadge}>PREMIUM</Text>
        </View>
        <Text style={s.lockedTxt}>
          🔒 Unlock predictive trend analysis for every node — spot problems
          before they become UNSAFE alerts.
        </Text>
        <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/upgrade')}>
          <Text style={s.upgradeBtnTxt}>Upgrade to Premium</Text>
        </TouchableOpacity>
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
  cardLocked:  { borderColor: C.purple + '55', backgroundColor: 'rgba(167,139,250,0.06)' },
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingTxt:  { fontSize: 12, color: C.text1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title:       { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5 },
  premiumBadge:{ fontSize: 9, fontWeight: '700', color: C.purple, backgroundColor: 'rgba(167,139,250,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  insightTxt:  { fontSize: 13, color: C.text0, lineHeight: 19 },
  lockedTxt:   { fontSize: 12, color: C.text1, lineHeight: 18, marginBottom: 10 },
  upgradeBtn:  { backgroundColor: C.purple, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  upgradeBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
