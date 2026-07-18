// app/app/(tabs)/alerts.js
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter }  from 'expo-router';
import { supabase }   from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const PARAM_LABELS = {
  ph:          { label:'pH',          unit:'',     icon:'⚗️', limit:'5.0–9.7' },
  tds:         { label:'TDS',         unit:'mg/L', icon:'⚡', limit:'≤ 1200'  },
  turbidity:   { label:'Turbidity',   unit:'NTU',  icon:'💡', limit:'≤ 5'     },
  temperature: { label:'Temperature', unit:'°C',   icon:'🌡️', limit:'5–25'    },
};

const STATUS_STYLE = {
  UNSAFE:  { color:'#f87171', bg:'rgba(239,68,68,0.15)',  emoji:'🚨' },
  CAUTION: { color:'#fbbf24', bg:'rgba(245,158,11,0.15)', emoji:'⚠️' },
};

function AlertCard({ alert, onResolve }) {
  const router = useRouter();
  const ss = STATUS_STYLE[alert.sans_status] || STATUS_STYLE.CAUTION;
  const pm = PARAM_LABELS[alert.parameter] || { label: alert.parameter, unit:'', icon:'📊', limit:'—' };

  return (
    <View style={[s.card, alert.resolved_at && s.cardResolved]}>
      <View style={s.cardHead}>
        <View style={[s.alertIcon, { backgroundColor: ss.bg }]}>
          <Text style={{ fontSize:20 }}>{pm.icon}</Text>
        </View>
        <View style={{ flex:1 }}>
          <View style={s.titleRow}>
            <Text style={s.cardTitle}>{ss.emoji} {pm.label} {alert.sans_status}</Text>
            <View style={[s.badge, { backgroundColor: ss.bg }]}>
              <Text style={[s.badgeTxt, { color: ss.color }]}>{alert.sans_status}</Text>
            </View>
          </View>
          <Text style={s.cardDesc}>
            Reading: <Text style={{ color: ss.color, fontWeight:'700' }}>
              {typeof alert.value === 'number' ? alert.value.toFixed(alert.parameter === 'ph' ? 2 : 1) : alert.value}{pm.unit}
            </Text>
            {' '}— SANS 241 limit: {pm.limit}{pm.unit}
          </Text>
        </View>
      </View>

      {alert.nodes && (
        <TouchableOpacity style={s.nodeRow} onPress={() => router.push(`/node/${alert.node_id}`)}>
          <Text style={s.nodeRowTxt}>📍 {alert.nodes.location_name} · {alert.nodes.campus}</Text>
          <Text style={s.nodeRowLink}>View →</Text>
        </TouchableOpacity>
      )}

      <View style={s.cardFoot}>
        <Text style={s.cardTime}>
          {formatDistanceToNow(new Date(alert.created_at), { addSuffix:true })}
        </Text>
        {!alert.resolved_at ? (
          <TouchableOpacity style={s.resolveBtn} onPress={() => onResolve(alert.id)}>
            <Text style={s.resolveBtnTxt}>Mark Resolved</Text>
          </TouchableOpacity>
        ) : (
          <Text style={s.resolvedTxt}>✓ Resolved</Text>
        )}
      </View>
    </View>
  );
}

const FILTERS = [
  { value:'active',   label:'Active'   },
  { value:'unsafe',   label:'Unsafe'   },
  { value:'caution',  label:'Caution'  },
  { value:'resolved', label:'Resolved' },
];

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState('active');

  const fetchAlerts = useCallback(async () => {
    let query = supabase
      .from('alerts')
      .select('*, nodes(location_name, campus)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'active')   query = query.is('resolved_at', null);
    if (filter === 'resolved') query = query.not('resolved_at', 'is', null);
    if (filter === 'unsafe')   query = query.eq('sans_status', 'UNSAFE').is('resolved_at', null);
    if (filter === 'caution')  query = query.eq('sans_status', 'CAUTION').is('resolved_at', null);

    const { data } = await query;
    setAlerts(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel('alerts-live')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'alerts' },
        payload => setAlerts(prev => [payload.new, ...prev]))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'alerts' },
        payload => setAlerts(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a)))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const resolveAlert = async (alertId) => {
    await supabase.from('alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', alertId);
    setAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, resolved_at: new Date().toISOString() } : a)
    );
  };

  const activeCount = alerts.filter(a => !a.resolved_at).length;
  const unsafeCount = alerts.filter(a => !a.resolved_at && a.sans_status === 'UNSAFE').length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Alerts</Text>
        <Text style={s.headerSub}>
          {unsafeCount > 0
            ? `🚨 ${unsafeCount} UNSAFE · ${activeCount} total active`
            : `${activeCount} active alert${activeCount !== 1 ? 's' : ''}`}
        </Text>
      </View>

      <View style={s.chips}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.value}
            style={[s.chip, filter === f.value && s.chipActive]}
            onPress={() => setFilter(f.value)}>
            <Text style={[s.chipTxt, filter === f.value && s.chipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={alerts}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding:14, paddingBottom:90, gap:8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
        ListEmptyComponent={
          !loading && (
            <View style={s.empty}>
              <Text style={{ fontSize:48 }}>✅</Text>
              <Text style={s.emptyTitle}>All clear!</Text>
              <Text style={s.emptyDesc}>
                {filter === 'resolved'
                  ? 'No resolved alerts yet.'
                  : 'All nodes within SANS 241:2015 limits.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <AlertCard alert={item} onResolve={resolveAlert} />}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex:1, backgroundColor:C.bg0 },
  header:      { backgroundColor:C.bg1, paddingHorizontal:18, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border },
  headerTitle: { fontSize:20, fontWeight:'700', color:C.text0 },
  headerSub:   { fontSize:12, color:C.text1, marginTop:2 },
  chips:       { flexDirection:'row', gap:6, padding:10, paddingHorizontal:14 },
  chip:        { paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:C.bg2, borderWidth:1, borderColor:C.border },
  chipActive:  { backgroundColor:'rgba(59,130,246,0.2)', borderColor:'rgba(59,130,246,0.5)' },
  chipTxt:     { fontSize:12, fontWeight:'600', color:C.text1 },
  chipTxtActive:{ color:C.blueLight },
  card:        { backgroundColor:C.bg2, borderRadius:14, padding:14, borderWidth:1, borderColor:C.border },
  cardResolved:{ opacity:0.55 },
  cardHead:    { flexDirection:'row', gap:10, alignItems:'flex-start', marginBottom:10 },
  alertIcon:   { width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  titleRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', gap:6, marginBottom:4 },
  cardTitle:   { fontSize:13, fontWeight:'700', color:C.text0, flex:1 },
  badge:       { paddingHorizontal:7, paddingVertical:2, borderRadius:8, flexShrink:0 },
  badgeTxt:    { fontSize:9, fontWeight:'700', textTransform:'uppercase' },
  cardDesc:    { fontSize:12, color:C.text1, lineHeight:17 },
  nodeRow:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:C.bg3, borderRadius:8, padding:8, marginBottom:8 },
  nodeRowTxt:  { fontSize:11, color:C.text1 },
  nodeRowLink: { fontSize:11, fontWeight:'600', color:C.blueLight },
  cardFoot:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  cardTime:    { fontSize:10, color:C.text2 },
  resolveBtn:  { backgroundColor:'rgba(34,197,94,0.15)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(34,197,94,0.3)' },
  resolveBtnTxt:{ fontSize:11, fontWeight:'600', color:C.green },
  resolvedTxt: { fontSize:10, color:C.green, fontWeight:'500' },
  empty:       { alignItems:'center', paddingTop:60, gap:10 },
  emptyTitle:  { fontSize:18, fontWeight:'700', color:C.text0 },
  emptyDesc:   { fontSize:13, color:C.text2, textAlign:'center', lineHeight:19 },
});
