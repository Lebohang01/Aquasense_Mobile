// app/(tabs)/history.js — Timestamped readings history log
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6', cyan:'#06b6d4',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const METRICS = [
  { key:'ph',          label:'pH',          unit:'',     color:C.blue,   icon:'⚗️',  safe:[5.0,9.7]   },
  { key:'tds',         label:'TDS',         unit:'mg/L', color:C.amber,  icon:'⚡',  safe:[0,1200]    },
  { key:'turbidity',   label:'Turbidity',   unit:'NTU',  color:C.purple, icon:'💡',  safe:[0,5]       },
  { key:'temperature', label:'Temp',        unit:'°C',   color:C.cyan,   icon:'🌡️',  safe:[5,25]      },
];

const RANGES = [
  { label:'24h', days:1  },
  { label:'7d',  days:7  },
  { label:'30d', days:30 },
];

const STATUS_STYLE = {
  SAFE:    { color:C.green,  bg:'rgba(34,197,94,0.15)',  emoji:'✅' },
  CAUTION: { color:C.amber,  bg:'rgba(245,158,11,0.15)', emoji:'⚠️' },
  UNSAFE:  { color:C.red,    bg:'rgba(239,68,68,0.15)',  emoji:'🚨' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d))     return `Today, ${format(d,'HH:mm')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d,'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

function getTrend(readings, key) {
  if (!readings || readings.length < 2) return null;
  const last  = readings[readings.length - 1]?.[key];
  const prev  = readings[readings.length - 2]?.[key];
  if (last === undefined || prev === undefined) return null;
  const diff = last - prev;
  if (Math.abs(diff) < 0.01) return { dir:'stable', txt:'Stable', color:C.text2 };
  return diff > 0
    ? { dir:'up',   txt:`▲ +${Math.abs(diff).toFixed(1)}`, color:C.amber }
    : { dir:'down', txt:`▼ −${Math.abs(diff).toFixed(1)}`, color:C.green };
}

function isInRange(val, safe) {
  return val >= safe[0] && val <= safe[1];
}

function ReadingCard({ reading }) {
  const ss = STATUS_STYLE[reading.sans_status] || STATUS_STYLE.SAFE;
  return (
    <View style={rc.card}>
      <View style={rc.head}>
        <View style={{ flex:1 }}>
          <Text style={rc.nodeName}>{reading.nodes?.location_name || 'Unknown Node'}</Text>
          <Text style={rc.campus}>{reading.nodes?.campus} · {formatDate(reading.created_at)}</Text>
        </View>
        <View style={[rc.statusBadge, { backgroundColor:ss.bg }]}>
          <Text style={[rc.statusTxt, { color:ss.color }]}>{ss.emoji} {reading.sans_status}</Text>
        </View>
      </View>
      <View style={rc.metricsRow}>
        {METRICS.map(m => {
          const val = reading[m.key];
          const ok  = val !== undefined ? isInRange(val, m.safe) : true;
          return (
            <View key={m.key} style={rc.metric}>
              <Text style={{ fontSize:12 }}>{m.icon}</Text>
              <Text style={[rc.metricVal, !ok && { color:C.amber }]}>
                {typeof val === 'number' ? val.toFixed(m.key==='ph'?1:0) : '—'}
              </Text>
              <Text style={rc.metricUnit}>{m.unit||m.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={rc.timeAgo}>{formatDistanceToNow(new Date(reading.created_at), { addSuffix:true })}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const [readings,    setReadings]    = useState([]);
  const [nodes,       setNodes]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [metric,      setMetric]      = useState('ph');
  const [range,       setRange]       = useState(7);
  const [selectedNode,setSelectedNode]= useState('all');
  const [stats,       setStats]       = useState(null);

  const fetchData = useCallback(async () => {
    const since = new Date(Date.now() - range * 86400000).toISOString();
    let q = supabase
      .from('readings')
      .select('*, nodes(node_id, location_name, campus)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (selectedNode !== 'all') q = q.eq('node_id', selectedNode);

    const { data } = await q;
    setReadings(data || []);

    // Compute stats for selected metric
    if (data && data.length > 0) {
      const vals = data.map(r => r[metric]).filter(v => v !== undefined && v !== null);
      if (vals.length > 0) {
        setStats({
          avg: (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2),
          min: Math.min(...vals).toFixed(2),
          max: Math.max(...vals).toFixed(2),
          count: data.length,
        });
      }
    } else {
      setStats(null);
    }
    setLoading(false);
  }, [range, selectedNode, metric]);

  const fetchNodes = useCallback(async () => {
    const { data } = await supabase.from('nodes').select('node_id, location_name, campus').order('campus');
    setNodes(data || []);
  }, []);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const activeMetric = METRICS.find(m => m.key === metric) || METRICS[0];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📊 History</Text>
          <Text style={s.headerSub}>Timestamped readings log</Text>
        </View>
        <View style={s.rangeTabs}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r.label}
              style={[s.rangeTab, range===r.days && s.rangeTabActive]}
              onPress={() => setRange(r.days)}
            >
              <Text style={[s.rangeTabTxt, range===r.days && s.rangeTabTxtActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Metric selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.metricsBar} contentContainerStyle={{ paddingHorizontal:14, gap:8 }}>
        {METRICS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.metricChip, metric===m.key && { backgroundColor:m.color+'25', borderColor:m.color }]}
            onPress={() => setMetric(m.key)}
          >
            <Text style={{ fontSize:14 }}>{m.icon}</Text>
            <Text style={[s.metricChipTxt, metric===m.key && { color:m.color }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats row */}
      {stats && (
        <View style={s.statsCard}>
          <Text style={s.statsTitle}>
            {activeMetric.icon} {activeMetric.label} — Last {range===1?'24 hours':`${range} days`}
          </Text>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color:activeMetric.color }]}>{stats.avg}</Text>
              <Text style={s.statLbl}>Avg</Text>
            </View>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color:C.green }]}>{stats.min}</Text>
              <Text style={s.statLbl}>Min</Text>
            </View>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color:C.amber }]}>{stats.max}</Text>
              <Text style={s.statLbl}>Max</Text>
            </View>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color:C.blueLight }]}>{stats.count}</Text>
              <Text style={s.statLbl}>Readings</Text>
            </View>
          </View>
          <Text style={s.statsNote}>SANS 241 safe range: {activeMetric.safe[0]}–{activeMetric.safe[1]}{activeMetric.unit}</Text>
        </View>
      )}

      {/* Node filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.nodeFilter} contentContainerStyle={{ paddingHorizontal:14, gap:6 }}>
        <TouchableOpacity
          style={[s.nodeChip, selectedNode==='all' && s.nodeChipActive]}
          onPress={() => setSelectedNode('all')}
        >
          <Text style={[s.nodeChipTxt, selectedNode==='all' && s.nodeChipTxtActive]}>All Nodes</Text>
        </TouchableOpacity>
        {nodes.map(n => (
          <TouchableOpacity
            key={n.node_id}
            style={[s.nodeChip, selectedNode===n.node_id && s.nodeChipActive]}
            onPress={() => setSelectedNode(n.node_id)}
          >
            <Text style={[s.nodeChipTxt, selectedNode===n.node_id && s.nodeChipTxtActive]}>
              {n.location_name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Readings list */}
      <Text style={s.recentLabel}>RECENT READINGS</Text>

      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop:40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:14, paddingBottom:90, gap:8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
        >
          {readings.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize:40 }}>📊</Text>
              <Text style={s.emptyTxt}>No readings in this period</Text>
              <Text style={s.emptyHint}>Insert test readings via Supabase SQL Editor</Text>
            </View>
          ) : (
            readings.map(r => <ReadingCard key={r.id} reading={r} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor:C.bg0 },
  header:       { backgroundColor:C.bg1, paddingHorizontal:16, paddingVertical:14, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderBottomColor:C.border },
  headerTitle:  { fontSize:18, fontWeight:'700', color:C.text0 },
  headerSub:    { fontSize:11, color:C.text2, marginTop:2 },
  rangeTabs:    { flexDirection:'row', backgroundColor:C.bg2, borderRadius:10, padding:2, borderWidth:1, borderColor:C.border },
  rangeTab:     { paddingHorizontal:12, paddingVertical:5, borderRadius:8 },
  rangeTabActive:{ backgroundColor:C.blue },
  rangeTabTxt:  { fontSize:12, fontWeight:'600', color:C.text2 },
  rangeTabTxtActive:{ color:'white' },
  metricsBar:   { paddingVertical:10, maxHeight:52 },
  metricChip:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:C.bg2, borderWidth:1, borderColor:C.border },
  metricChipTxt:{ fontSize:12, fontWeight:'600', color:C.text1 },
  statsCard:    { backgroundColor:C.bg2, marginHorizontal:14, borderRadius:12, padding:14, borderWidth:1, borderColor:C.border, marginTop:4 },
  statsTitle:   { fontSize:13, fontWeight:'700', color:C.text0, marginBottom:10 },
  statsRow:     { flexDirection:'row', justifyContent:'space-around', marginBottom:8 },
  statItem:     { alignItems:'center' },
  statVal:      { fontSize:20, fontWeight:'700', letterSpacing:-0.5 },
  statLbl:      { fontSize:10, color:C.text2, marginTop:2 },
  statsNote:    { fontSize:11, color:C.text2 },
  nodeFilter:   { paddingVertical:8, maxHeight:48 },
  nodeChip:     { paddingHorizontal:12, paddingVertical:5, borderRadius:20, backgroundColor:C.bg2, borderWidth:1, borderColor:C.border },
  nodeChipActive:{ backgroundColor:'rgba(59,130,246,0.2)', borderColor:'rgba(59,130,246,0.5)' },
  nodeChipTxt:  { fontSize:11, fontWeight:'600', color:C.text1 },
  nodeChipTxtActive:{ color:C.blueLight },
  recentLabel:  { fontSize:10, fontWeight:'700', color:C.text2, textTransform:'uppercase', letterSpacing:0.8, paddingHorizontal:16, paddingVertical:8 },
  empty:        { alignItems:'center', paddingTop:60, gap:10 },
  emptyTxt:     { fontSize:15, color:C.text2 },
  emptyHint:    { fontSize:12, color:C.text2, textAlign:'center' },
});

const rc = StyleSheet.create({
  card:       { backgroundColor:C.bg2, borderRadius:12, padding:14, borderWidth:1, borderColor:C.border },
  head:       { flexDirection:'row', alignItems:'flex-start', marginBottom:10 },
  nodeName:   { fontSize:13, fontWeight:'700', color:C.text0 },
  campus:     { fontSize:11, color:C.text2, marginTop:2 },
  statusBadge:{ paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  statusTxt:  { fontSize:10, fontWeight:'700' },
  metricsRow: { flexDirection:'row', justifyContent:'space-around', backgroundColor:C.bg3, borderRadius:8, padding:10, marginBottom:6 },
  metric:     { alignItems:'center', gap:2 },
  metricVal:  { fontSize:15, fontWeight:'700', color:C.text0 },
  metricUnit: { fontSize:9, color:C.text2 },
  timeAgo:    { fontSize:10, color:C.text2, textAlign:'right' },
});
