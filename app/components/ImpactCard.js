// app/components/ImpactCard.js
// Civic engagement: points, streak, and sustainability impact
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  bg2: '#151c30', bg3: '#1c2540',
  blue: '#3b82f6', blueLight: '#60a5fa', green: '#22c55e', amber: '#f59e0b',
  text0: '#f1f5f9', text1: '#94a3b8', text2: '#475569', border: '#1e2d47',
};

// Rough estimate: each check-in represents one refill instead of buying
// a bottled water — used purely for a motivating, illustrative stat
const BOTTLES_PER_CHECKIN = 1;

export default function ImpactCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStats(null); return; }

      const [{ data: profile }, { count: checkinCount }] = await Promise.all([
        supabase.from('users').select('points, streak_count').eq('id', user.id).maybeSingle(),
        supabase.from('check_ins').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setStats({
        points: profile?.points || 0,
        streak: profile?.streak_count || 0,
        bottlesSaved: (checkinCount || 0) * BOTTLES_PER_CHECKIN,
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={s.card}>
        <ActivityIndicator size="small" color={C.blue} />
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View style={s.card}>
      <Text style={s.title}>Your Impact</Text>
      <View style={s.row}>
        <View style={s.stat}>
          <Text style={s.statEmoji}>⭐</Text>
          <Text style={s.statNum}>{stats.points}</Text>
          <Text style={s.statLabel}>Points</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statEmoji}>🔥</Text>
          <Text style={[s.statNum, { color: C.amber }]}>{stats.streak}</Text>
          <Text style={s.statLabel}>Day streak</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statEmoji}>♻️</Text>
          <Text style={[s.statNum, { color: C.green }]}>{stats.bottlesSaved}</Text>
          <Text style={s.statLabel}>Bottles saved</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:      { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  title:     { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row:       { flexDirection: 'row', justifyContent: 'space-around' },
  stat:      { alignItems: 'center' },
  statEmoji: { fontSize: 20, marginBottom: 4 },
  statNum:   { fontSize: 20, fontWeight: '700', color: C.text0 },
  statLabel: { fontSize: 10, color: C.text2, marginTop: 2 },
});
