// app/app/(tabs)/index.js — Dashboard with Realtime live updates
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { evaluateReading, PARAMETER_UNITS, CAMPUS_LABELS } from '@/utils/sans241';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

function NodeCard({ node, onPress, refreshTick }) {
  const [latest,  setLatest]  = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-fetch when parent tells us new data arrived (refreshTick changes)
  useEffect(() => {
    supabase
      .from('readings')
      .select('*')
      .eq('node_id', node.node_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setLatest(data[0]);
        setLoading(false);
      });
  }, [node.node_id, refreshTick]);

  const eval_ = latest ? evaluateReading({
    ph:          latest.ph,
    tds:         latest.tds,
    turbidity:   latest.turbidity,
    temperature: latest.temperature,
  }) : null;
  const isOnline = node.status === 'online';

  return (
    <TouchableOpacity style={s.nodeCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.nodeHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.nodeName}>{node.location_name}</Text>
          <Text style={s.nodeCampus}>{CAMPUS_LABELS[node.campus] || node.campus}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[s.onlinePill, { backgroundColor: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)' }]}>
            <View style={[s.onlineDot, { backgroundColor: isOnline ? C.green : C.text2 }]} />
            <Text style={[s.onlineTxt, { color: isOnline ? C.green : C.text2 }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {eval_ && (
            <View style={[s.statusBadge, { backgroundColor: eval_.bg }]}>
              <Text style={[s.statusBadgeTxt, { color: eval_.color }]}>
                {eval_.emoji} {eval_.status}
              </Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={C.blue} />
          <Text style={s.loadingTxt}>Loading...</Text>
        </View>
      ) : latest ? (
        <View style={s.metricRow}>
          {Object.entries(PARAMETER_UNITS).map(([key, meta]) => {
            const val     = latest[key];
            const display = typeof val === 'number'
              ? (val > 99 ? Math.round(val) : val.toFixed(key === 'ph' ? 1 : 0))
              : '—';
            return (
              <View key={key} style={s.metricItem}>
                <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                <Text style={s.metricVal}>{display}</Text>
                <Text style={s.metricUnit}>{meta.unit || meta.label}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={s.loadingRow}>
          <Text style={s.loadingTxt}>No readings yet</Text>
        </View>
      )}

      {eval_?.issues?.length > 0 && (
        <View style={[s.issueRow, { backgroundColor: eval_.bg }]}>
          <Text style={[s.issueTxt, { color: eval_.color }]}>
            {eval_.emoji} {eval_.issues.join(', ')} out of SANS 241 range
          </Text>
        </View>
      )}
      <Text style={s.tapHint}>Tap for details →</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router           = useRouter();
  const [nodes,          setNodes]         = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [refreshing,     setRefreshing]    = useState(false);
  const [alertCount,     setAlertCount]    = useState(0);
  const [selectedCampus, setSelectedCampus]= useState('All');
  const [error,          setError]         = useState(null);
  // Increment this to tell NodeCards to re-fetch their latest reading
  const [refreshTick,    setRefreshTick]   = useState(0);
  const channelRef = useRef(null);

  const fetchNodes = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('nodes')
        .select('*')
        .order('campus')
        .order('location_name');
      if (err) { setError(err.message); return; }
      setNodes(data || []);
      setError(null);
      console.log('[Dashboard] nodes fetched:', data?.length);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlertCount = useCallback(async () => {
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null);
    setAlertCount(count || 0);
  }, []);

  useEffect(() => {
    fetchNodes();
    fetchAlertCount();

    // Clean up old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to live readings & alerts
    const channel = supabase
      .channel('dashboard-live-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings' },
        (payload) => {
          console.log('[Realtime] new reading for node:', payload.new?.node_id);
          // Bump tick so NodeCards re-fetch
          setRefreshTick(t => t + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('[Realtime] new alert');
          fetchAlertCount();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNodes();
    await fetchAlertCount();
    setRefreshTick(t => t + 1);
    setRefreshing(false);
  }, [fetchNodes, fetchAlertCount]);

  const campuses   = ['All', ...new Set(nodes.map(n => n.campus))];
  const filtered   = selectedCampus === 'All' ? nodes : nodes.filter(n => n.campus === selectedCampus);
  const onlineCount= nodes.filter(n => n.status === 'online').length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={s.logo}>
              <View style={s.logoIcon}><Text style={{ fontSize: 22 }}>💧</Text></View>
              <View>
                <Text style={s.logoTxt}>AquaSense UJ</Text>
                <Text style={s.logoSub}>SANS 241:2015 Monitor</Text>
              </View>
            </View>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(tabs)/alerts')}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {alertCount > 0 && (
                <View style={s.alertBadge}>
                  <Text style={s.alertBadgeTxt}>{alertCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.statsRow}>
            {[
              { label: 'Nodes',    val: nodes.length },
              { label: 'Online',   val: onlineCount  },
              { label: 'Alerts',   val: alertCount   },
              { label: 'Campuses', val: [...new Set(nodes.map(n => n.campus))].length },
            ].map(st => (
              <View key={st.label} style={s.statItem}>
                <Text style={s.statVal}>{st.val}</Text>
                <Text style={s.statLbl}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor:'rgba(59,130,246,0.1)',
            borderRadius:10,
            padding:10,
            flexDirection:'row',
            alignItems:'center',
            justifyContent:'space-between',
            marginTop:12,
            borderWidth:1,
            borderColor:'rgba(59,130,246,0.25)',
          }}
          onPress={() => router.push('/(tabs)/history')}
        >
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ fontSize:16 }}>📊</Text>
            <View>
              <Text style={{ fontSize:13, fontWeight:'700', color:'#f1f5f9' }}>Readings History</Text>
              <Text style={{ fontSize:11, color:'#475569', marginTop:1 }}>View timestamped logs & trends</Text>
            </View>
          </View>
          <Text style={{ fontSize:18, color:'#60a5fa' }}>›</Text>
        </TouchableOpacity>

        {/* Campus chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsWrap} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
          {campuses.map(c => (
            <TouchableOpacity key={c} style={[s.chip, selectedCampus === c && s.chipActive]} onPress={() => setSelectedCampus(c)}>
              <Text style={[s.chipTxt, selectedCampus === c && s.chipTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Legend */}
        <View style={s.legend}>
          {[['✅','SAFE','#22c55e'],['⚠️','CAUTION','#f59e0b'],['🚨','UNSAFE','#ef4444']].map(([e,l,c])=>(
            <View key={l} style={s.legendItem}>
              <Text style={{ fontSize: 12 }}>{e}</Text>
              <Text style={[s.legendTxt, { color: c }]}>{l}</Text>
            </View>
          ))}
          <Text style={s.legendNote}>SANS 241:2015</Text>
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>⚠️ {error}</Text>
            <TouchableOpacity onPress={fetchNodes}><Text style={s.retryTxt}>Tap to retry</Text></TouchableOpacity>
          </View>
        )}

        {/* Node cards */}
        <View style={{ padding: 14, gap: 10 }}>
          {loading ? (
            <View style={s.loadingCenter}>
              <ActivityIndicator size="large" color={C.blue} />
              <Text style={s.loadingCenterTxt}>Loading nodes...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>💧</Text>
              <Text style={s.emptyTxt}>No nodes on {selectedCampus} campus</Text>
            </View>
          ) : (
            filtered.map(node => (
              <NodeCard
                key={node.node_id + '-' + refreshTick}
                node={node}
                refreshTick={refreshTick}
                onPress={() => router.push(`/node/${node.node_id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg0 },
  hero:    { backgroundColor: '#0a1628', padding: 20, paddingBottom: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon:{ width: 40, height: 40, backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  logoTxt: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', letterSpacing: -0.4 },
  logoSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  iconBtn: { width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', position: 'relative' },
  alertBadge:    { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  alertBadgeTxt: { fontSize: 9, fontWeight: '700', color: 'white' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statVal:  { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  statLbl:  { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  chipsWrap:    { paddingVertical: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#151c30', borderWidth: 1, borderColor: '#1e2d47' },
  chipActive:   { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.5)' },
  chipTxt:      { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  chipTxtActive:{ color: '#60a5fa' },
  legend:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendTxt:  { fontSize: 11, fontWeight: '600' },
  legendNote: { fontSize: 10, color: '#475569', marginLeft: 'auto' },
  nodeCard:   { backgroundColor: '#151c30', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e2d47' },
  nodeHead:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nodeName:   { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  nodeCampus: { fontSize: 11, color: '#475569', marginTop: 2 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  onlineDot:  { width: 5, height: 5, borderRadius: 3 },
  onlineTxt:  { fontSize: 10, fontWeight: '600' },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700' },
  metricRow:  { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1c2540', borderRadius: 10, padding: 10, marginBottom: 8 },
  metricItem: { alignItems: 'center', gap: 2 },
  metricVal:  { fontSize: 16, fontWeight: '700', color: '#f1f5f9', letterSpacing: -0.5 },
  metricUnit: { fontSize: 9, color: '#475569' },
  loadingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, justifyContent: 'center' },
  loadingTxt:       { fontSize: 12, color: '#475569' },
  loadingCenter:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingCenterTxt: { fontSize: 14, color: '#475569' },
  issueRow: { borderRadius: 8, padding: 8, marginBottom: 6 },
  issueTxt: { fontSize: 11, fontWeight: '600' },
  tapHint:  { fontSize: 10, color: '#475569', textAlign: 'right', marginTop: 2 },
  empty:    { alignItems: 'center', padding: 48, gap: 10 },
  emptyTxt: { fontSize: 14, color: '#475569' },
  errorBox: { margin: 14, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', gap: 6 },
  errorTxt: { fontSize: 13, color: '#ef4444', textAlign: 'center' },
  retryTxt: { fontSize: 12, color: '#60a5fa', fontWeight: '600' },
});
