// app/app/leaderboard/index.js
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const C = {
  bg0: '#0a0e1a', bg1: '#0f1525', bg2: '#151c30', bg3: '#1c2540',
  blue: '#3b82f6', blueLight: '#60a5fa', amber: '#f59e0b', purple: '#a78bfa',
  text0: '#f1f5f9', text1: '#94a3b8', text2: '#475569', border: '#1e2d47',
};

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('week'); // 'week' | 'alltime'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState(null);

  const load = useCallback(async (which) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setMyId(user?.id || null);

      if (which === 'alltime') {
        const { data } = await supabase
          .from('users')
          .select('id, display_name, email, points')
          .order('points', { ascending: false })
          .limit(20);
        setRows((data || []).map(r => ({ id: r.id, name: r.display_name || r.email?.split('@')[0] || 'Student', points: r.points || 0 })));
      } else {
        const { data: weekly } = await supabase
          .from('weekly_points')
          .select('user_id, points')
          .order('points', { ascending: false })
          .limit(20);

        const ids = (weekly || []).map(w => w.user_id);
        if (ids.length === 0) { setRows([]); return; }

        const { data: profiles } = await supabase
          .from('users')
          .select('id, display_name, email')
          .in('id', ids);

        const nameById = {};
        (profiles || []).forEach(p => { nameById[p.id] = p.display_name || p.email?.split('@')[0] || 'Student'; });

        setRows((weekly || []).map(w => ({ id: w.user_id, name: nameById[w.user_id] || 'Student', points: w.points })));
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backTxt}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Water Guardians</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'week' && s.tabActive]} onPress={() => setTab('week')}>
          <Text style={[s.tabTxt, tab === 'week' && s.tabTxtActive]}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'alltime' && s.tabActive]} onPress={() => setTab('alltime')}>
          <Text style={[s.tabTxt, tab === 'alltime' && s.tabTxtActive]}>All-Time</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
      ) : rows.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 36 }}>🏆</Text>
          <Text style={s.emptyTxt}>No activity yet {tab === 'week' ? 'this week' : ''}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          renderItem={({ item, index }) => {
            const isMe = item.id === myId;
            return (
              <View style={[s.row, isMe && s.rowMe]}>
                <View style={s.rankWrap}>
                  {index < 3
                    ? <Text style={{ fontSize: 20 }}>{MEDALS[index]}</Text>
                    : <Text style={s.rankTxt}>{index + 1}</Text>}
                </View>
                <Text style={[s.name, isMe && s.nameMe]} numberOfLines={1}>
                  {item.name}{isMe ? ' (You)' : ''}
                </Text>
                <Text style={s.points}>{item.points} pts</Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bg1, borderBottomWidth: 1, borderBottomColor: C.border },
  backTxt:    { fontSize: 14, fontWeight: '600', color: C.blueLight, width: 50 },
  headerTitle:{ fontSize: 16, fontWeight: '700', color: C.text0 },
  tabs:       { flexDirection: 'row', gap: 8, padding: 14 },
  tab:        { flex: 1, backgroundColor: C.bg2, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  tabActive:  { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
  tabTxt:     { fontSize: 13, fontWeight: '600', color: C.text1 },
  tabTxtActive: { color: C.blueLight },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  rowMe:      { borderColor: C.purple + '77', backgroundColor: 'rgba(167,139,250,0.08)' },
  rankWrap:   { width: 28, alignItems: 'center' },
  rankTxt:    { fontSize: 14, fontWeight: '700', color: C.text2 },
  name:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.text0 },
  nameMe:     { color: C.purple },
  points:     { fontSize: 13, fontWeight: '700', color: C.amber },
  empty:      { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyTxt:   { fontSize: 13, color: C.text2 },
});
