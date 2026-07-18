// app/app/node/[id].js
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase }            from '@/lib/supabase';
import { useRealtimeNode }     from '@/hooks/useRealtimeNode';
import { useReadingHistory }   from '@/hooks/useNodes';
import { evaluateReading, PARAMETER_UNITS } from '@/utils/sans241';
import { LineChart }           from '@/components/LineChart';
import { formatDistanceToNow, format } from 'date-fns';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa', cyan:'#06b6d4',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const METRIC_COLORS = {
  ph:'#3b82f6', tds:'#f59e0b', turbidity:'#8b5cf6', temperature:'#06b6d4',
};

const CHART_RANGES = [
  { label:'24h', days:1  },
  { label:'7d',  days:7  },
  { label:'30d', days:30 },
];

function MetricBlock({ metricKey, value, meta, status }) {
  const ss = {
    good:     { color:'#4ade80', bg:'rgba(34,197,94,0.12)'  },
    warning:  { color:'#fbbf24', bg:'rgba(245,158,11,0.12)' },
    critical: { color:'#f87171', bg:'rgba(239,68,68,0.12)'  },
  }[status] || { color:C.text1, bg:C.bg3 };

  const display = typeof value === 'number'
    ? (value > 100 ? Math.round(value) : value.toFixed(metricKey === 'ph' ? 2 : 1))
    : '—';

  return (
    <View style={[mb.card, { borderColor: ss.color + '40' }]}>
      <View style={mb.top}>
        <View style={[mb.iconWrap, { backgroundColor: ss.bg }]}>
          <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
        </View>
        <View style={[mb.badge, { backgroundColor: ss.bg }]}>
          <Text style={[mb.badgeTxt, { color: ss.color }]}>
            {status === 'good' ? 'OK' : status === 'warning' ? 'CAUTION' : 'UNSAFE'}
          </Text>
        </View>
      </View>
      <Text style={mb.val}>{display}</Text>
      <Text style={mb.unit}>{meta.unit || meta.label}</Text>
      <Text style={mb.label}>{meta.label}</Text>
      <Text style={mb.range}>SANS: {meta.range}</Text>
    </View>
  );
}

export default function NodeDetailScreen() {
  const { id }    = useLocalSearchParams();
  const router    = useRouter();
  const { width } = useWindowDimensions();

  const [node,        setNode]        = useState(null);
  const [latest,      setLatest]      = useState(null);
  const [alerts,      setAlerts]      = useState([]);
  const [chartMetric, setChartMetric] = useState('ph');
  const [chartRange,  setChartRange]  = useState(7);
  const [loadingNode, setLoadingNode] = useState(true);

  const realtimeReading = useRealtimeNode(id);
  const { history, loading: historyLoading } = useReadingHistory(id, chartRange);

  useEffect(() => {
    if (realtimeReading) setLatest(realtimeReading);
  }, [realtimeReading]);

  useEffect(() => {
    supabase.from('nodes').select('*').eq('node_id', id).single()
      .then(({ data }) => { setNode(data); setLoadingNode(false); });

    supabase.from('readings').select('*').eq('node_id', id)
      .order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setLatest(data); });

    supabase.from('alerts').select('*').eq('node_id', id)
      .is('resolved_at', null).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setAlerts(data || []));
  }, [id]);

  if (loadingNode) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const eval_ = latest ? evaluateReading(latest) : null;

  // Build chart data from history
  const chartData = history
    .filter(r => r[chartMetric] != null)
    .map(r => ({ x: new Date(r.created_at), y: parseFloat(r[chartMetric]) }));

  // Chart width = screen width minus padding
  const chartW = width - 56;

  function metricStatus(key, val) {
    if (val === undefined || val === null) return 'good';
    const L = {
      ph:{ min:5.0,max:9.7 }, tds:{ min:0,max:1200 },
      turbidity:{ min:0,max:5 }, temperature:{ min:5,max:25 },
    };
    const l = L[key];
    if (!l) return 'good';
    if (val > l.max * 1.2 || val < l.min * 0.7) return 'critical';
    if (val > l.max       || val < l.min)        return 'warning';
    return 'good';
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{node?.location_name}</Text>
          <Text style={s.headerSub}>{node?.campus}</Text>
        </View>
        {eval_ && (
          <View style={[s.statusPill, { backgroundColor: eval_.bg }]}>
            <Text style={[s.statusPillTxt, { color: eval_.color }]}>
              {eval_.emoji} {eval_.status}
            </Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:40 }}>

        {/* Node info */}
        <View style={s.infoBanner}>
          {[
            ['Node ID',      id?.slice(0,18)+'...'],
            ['Campus',       node?.campus],
            ['Status',       node?.status === 'online' ? '● Online' : '○ Offline'],
            ['Last seen',    node?.last_seen ? formatDistanceToNow(new Date(node.last_seen),{addSuffix:true}) : '—'],
            ['Last reading', latest?.created_at ? formatDistanceToNow(new Date(latest.created_at),{addSuffix:true}) : '—'],
          ].map(([lbl, val]) => (
            <View key={lbl} style={s.infoRow}>
              <Text style={s.infoLabel}>{lbl}</Text>
              <Text style={[s.infoVal, lbl==='Status' && { color: node?.status==='online' ? C.green : C.text2 }]}>
                {val || '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Metric grid */}
        <Text style={s.sectionLabel}>LIVE READINGS</Text>
        <View style={s.metricsGrid}>
          {Object.entries(PARAMETER_UNITS).map(([key, meta]) => (
            <MetricBlock
              key={key} metricKey={key}
              value={latest?.[key]}
              meta={meta}
              status={metricStatus(key, latest?.[key])}
            />
          ))}
        </View>

        {/* SANS 241 banner */}
        {eval_ && (
          <View style={[s.sansBanner, { backgroundColor:eval_.bg, borderColor:eval_.color+'40' }]}>
            <Text style={[s.sansBannerTitle, { color:eval_.color }]}>
              {eval_.emoji} SANS 241:2015 — {eval_.status}
            </Text>
            <Text style={[s.sansBannerDesc, { color:eval_.color+'cc' }]}>
              {eval_.issues.length === 0
                ? 'All parameters within South African drinking water standards.'
                : `Out of range: ${eval_.issues.join(', ')}`}
            </Text>
          </View>
        )}

        {/* Chart */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Trend</Text>
            <View style={s.rangeTabs}>
              {CHART_RANGES.map(opt => (
                <TouchableOpacity
                  key={opt.label}
                  style={[s.rangeTab, chartRange===opt.days && s.rangeTabActive]}
                  onPress={() => setChartRange(opt.days)}
                >
                  <Text style={[s.rangeTabTxt, chartRange===opt.days && s.rangeTabTxtActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Metric selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:12 }} contentContainerStyle={{ gap:6 }}>
            {Object.entries(PARAMETER_UNITS).map(([key, meta]) => (
              <TouchableOpacity
                key={key}
                style={[s.metricTab, chartMetric===key && { backgroundColor:METRIC_COLORS[key]+'25', borderColor:METRIC_COLORS[key] }]}
                onPress={() => setChartMetric(key)}
              >
                <Text style={{ fontSize:13 }}>{meta.icon}</Text>
                <Text style={[s.metricTabTxt, chartMetric===key && { color:METRIC_COLORS[key] }]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {historyLoading ? (
            <ActivityIndicator color={C.blue} style={{ marginVertical:30 }} />
          ) : (
            <LineChart
              data={chartData}
              metric={chartMetric}
              color={METRIC_COLORS[chartMetric]}
              width={chartW}
              height={160}
              unit={PARAMETER_UNITS[chartMetric]?.unit || ''}
            />
          )}

          {chartData.length > 0 && (
            <View style={s.chartFooter}>
              <Text style={s.chartFooterTxt}>
                Min: {Math.min(...chartData.map(d=>d.y)).toFixed(1)}{PARAMETER_UNITS[chartMetric]?.unit}
              </Text>
              <Text style={s.chartFooterTxt}>
                SANS: {PARAMETER_UNITS[chartMetric]?.range}
              </Text>
              <Text style={s.chartFooterTxt}>
                Max: {Math.max(...chartData.map(d=>d.y)).toFixed(1)}{PARAMETER_UNITS[chartMetric]?.unit}
              </Text>
            </View>
          )}
        </View>

        {/* Active alerts */}
        {alerts.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ACTIVE ALERTS</Text>
            <View style={{ paddingHorizontal:14, gap:8 }}>
              {alerts.map(alert => (
                <View key={alert.id} style={s.alertRow}>
                  <Text style={{ fontSize:16 }}>
                    {alert.sans_status==='UNSAFE' ? '🚨' : '⚠️'}
                  </Text>
                  <View style={{ flex:1 }}>
                    <Text style={s.alertRowTitle}>
                      {PARAMETER_UNITS[alert.parameter]?.label || alert.parameter} — {alert.sans_status}
                    </Text>
                    <Text style={s.alertRowSub}>
                      Value: {alert.value} · Limit: {alert.threshold}
                    </Text>
                  </View>
                  <Text style={s.alertRowTime}>
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix:true })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Hardware info */}
        <Text style={s.sectionLabel}>HARDWARE</Text>
        <View style={s.hwCard}>
          {[
            ['Controller',  'ESP32-WROOM-32'],
            ['pH',          'Analog sensor · GPIO34 (ADC1_CH6)'],
            ['TDS',         'Keystudio V1.0 · GPIO35 (ADC1_CH7)'],
            ['Turbidity',   'Analog sensor · GPIO32 (ADC1_CH4)'],
            ['Temperature', 'DS18B20 OneWire · GPIO4'],
            ['Sampling',    '30 samples · 40ms interval (median)'],
            ['Interval',    'Every 15 min (deep sleep)'],
            ['Standard',    'SANS 241:2015'],
          ].map(([lbl, val]) => (
            <View key={lbl} style={s.hwRow}>
              <Text style={s.hwLabel}>{lbl}</Text>
              <Text style={s.hwVal}>{val}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex:1, backgroundColor:C.bg0 },
  header:        { backgroundColor:C.bg1, paddingHorizontal:14, paddingVertical:12, flexDirection:'row', alignItems:'center', gap:10, borderBottomWidth:1, borderBottomColor:C.border },
  backBtn:       { paddingHorizontal:8, paddingVertical:4 },
  backTxt:       { fontSize:14, fontWeight:'600', color:C.blueLight },
  headerTitle:   { fontSize:16, fontWeight:'700', color:C.text0 },
  headerSub:     { fontSize:11, color:C.text2, marginTop:1 },
  statusPill:    { paddingHorizontal:10, paddingVertical:4, borderRadius:20, flexShrink:0 },
  statusPillTxt: { fontSize:11, fontWeight:'700' },

  infoBanner: { margin:14, backgroundColor:C.bg2, borderRadius:12, padding:14, borderWidth:1, borderColor:C.border, gap:6 },
  infoRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  infoLabel:  { fontSize:11, color:C.text2 },
  infoVal:    { fontSize:12, fontWeight:'600', color:C.text1, flex:1, textAlign:'right' },

  sectionLabel: { fontSize:10, fontWeight:'700', color:C.text2, textTransform:'uppercase', letterSpacing:0.8, paddingHorizontal:14, marginBottom:8, marginTop:8 },
  metricsGrid:  { flexDirection:'row', flexWrap:'wrap', gap:8, paddingHorizontal:14, marginBottom:10 },

  sansBanner:      { marginHorizontal:14, marginBottom:12, borderRadius:12, padding:14, borderWidth:1 },
  sansBannerTitle: { fontSize:14, fontWeight:'700', marginBottom:4 },
  sansBannerDesc:  { fontSize:12, lineHeight:17 },

  chartCard:    { marginHorizontal:14, marginBottom:12, backgroundColor:C.bg2, borderRadius:14, padding:14, borderWidth:1, borderColor:C.border },
  chartHeader:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  chartTitle:   { fontSize:14, fontWeight:'700', color:C.text0 },
  rangeTabs:    { flexDirection:'row', gap:4, backgroundColor:C.bg1, borderRadius:8, padding:2 },
  rangeTab:     { paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  rangeTabActive:{ backgroundColor:C.bg3 },
  rangeTabTxt:  { fontSize:11, fontWeight:'600', color:C.text2 },
  rangeTabTxtActive:{ color:C.blueLight },
  metricTab:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:5, borderRadius:20, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border },
  metricTabTxt: { fontSize:11, fontWeight:'600', color:C.text1 },
  chartFooter:  { flexDirection:'row', justifyContent:'space-between', marginTop:8 },
  chartFooterTxt:{ fontSize:10, color:C.text2 },

  alertRow:      { backgroundColor:C.bg2, borderRadius:10, padding:12, flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderColor:C.border },
  alertRowTitle: { fontSize:13, fontWeight:'600', color:C.text0 },
  alertRowSub:   { fontSize:11, color:C.text2, marginTop:2 },
  alertRowTime:  { fontSize:10, color:C.text2 },

  hwCard: { marginHorizontal:14, backgroundColor:C.bg2, borderRadius:12, overflow:'hidden', borderWidth:1, borderColor:C.border },
  hwRow:  { flexDirection:'row', justifyContent:'space-between', padding:11, borderBottomWidth:1, borderBottomColor:C.border },
  hwLabel:{ fontSize:12, color:C.text2 },
  hwVal:  { fontSize:12, fontWeight:'600', color:C.text1, flex:1, textAlign:'right' },
});

const mb = StyleSheet.create({
  card:    { width:'47%', backgroundColor:C.bg2, borderRadius:12, padding:12, borderWidth:1, gap:2 },
  top:     { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 },
  iconWrap:{ width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center' },
  badge:   { paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  badgeTxt:{ fontSize:8, fontWeight:'700', textTransform:'uppercase' },
  val:     { fontSize:22, fontWeight:'700', color:C.text0, letterSpacing:-0.5 },
  unit:    { fontSize:10, color:C.text2, marginTop:-2 },
  label:   { fontSize:11, color:C.text1, marginTop:2 },
  range:   { fontSize:9, color:C.text2 },
});
