// app/app/admin/reports.js — Reports Management with user info & status control
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const STATUS_STYLES = {
  open:          { color:'#f87171', bg:'rgba(239,68,68,0.15)',   label:'Open',          emoji:'🔴' },
  investigating: { color:'#fbbf24', bg:'rgba(245,158,11,0.15)',  label:'Investigating',  emoji:'🟡' },
  resolved:      { color:'#4ade80', bg:'rgba(34,197,94,0.15)',   label:'Resolved',       emoji:'🟢' },
};

const ISSUE_LABELS = {
  taste:    { label:'Bad Taste',     emoji:'👅' },
  odour:    { label:'Strange Odour', emoji:'👃' },
  colour:   { label:'Discoloured',   emoji:'🎨' },
  pressure: { label:'Low Pressure',  emoji:'💧' },
  other:    { label:'Other Issue',   emoji:'❓' },
};

const STATUSES = ['open','investigating','resolved'];
const FILTERS  = ['all','open','investigating','resolved'];

function ReportDetailModal({ visible, report, onClose, onStatusChange }) {
  const [saving, setSaving] = useState(false);

  const updateStatus = async (newStatus) => {
    setSaving(true);
    const { error } = await supabase
      .from('reports')
      .update({ status: newStatus })
      .eq('id', report.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else onStatusChange(report.id, newStatus);
  };

  if (!report) return null;
  const ss   = STATUS_STYLES[report.status] || STATUS_STYLES.open;
  const issue = ISSUE_LABELS[report.issue_type] || { label: report.issue_type, emoji:'📝' };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dm.overlay}>
        <View style={dm.sheet}>
          <View style={dm.sheetHead}>
            <Text style={dm.sheetTitle}>📝 Report Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={dm.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Issue type */}
          <View style={dm.section}>
            <Text style={dm.sectionLabel}>ISSUE TYPE</Text>
            <View style={dm.issueRow}>
              <Text style={{ fontSize:24 }}>{issue.emoji}</Text>
              <Text style={dm.issueName}>{issue.label}</Text>
            </View>
          </View>

          {/* Status */}
          <View style={dm.section}>
            <Text style={dm.sectionLabel}>CURRENT STATUS</Text>
            <View style={[dm.statusBadge, { backgroundColor: ss.bg }]}>
              <Text style={[dm.statusTxt, { color: ss.color }]}>{ss.emoji} {ss.label}</Text>
            </View>
          </View>

          {/* User info */}
          <View style={dm.section}>
            <Text style={dm.sectionLabel}>SUBMITTED BY</Text>
            <View style={dm.infoBox}>
              <Text style={dm.infoRow}>📧 {report.users?.email || 'Anonymous'}</Text>
              <Text style={dm.infoRow}>🏛️ {report.users?.campus_preference || 'Unknown campus'}</Text>
              <Text style={dm.infoRow}>👤 Role: {report.users?.role || 'student'}</Text>
            </View>
          </View>

          {/* Node info */}
          <View style={dm.section}>
            <Text style={dm.sectionLabel}>WATER POINT</Text>
            <View style={dm.infoBox}>
              <Text style={dm.infoRow}>📡 {report.nodes?.location_name || 'Unknown'}</Text>
              <Text style={dm.infoRow}>🏛️ {report.nodes?.campus || '—'}</Text>
            </View>
          </View>

          {/* Description */}
          {report.description && (
            <View style={dm.section}>
              <Text style={dm.sectionLabel}>DESCRIPTION</Text>
              <View style={dm.descBox}>
                <Text style={dm.descTxt}>{report.description}</Text>
              </View>
            </View>
          )}

          {/* Submitted time */}
          <Text style={dm.time}>
            Submitted {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
          </Text>

          {/* Update status buttons */}
          <Text style={dm.sectionLabel}>UPDATE STATUS</Text>
          <View style={dm.statusBtns}>
            {STATUSES.map(st => {
              const style = STATUS_STYLES[st];
              const isActive = report.status === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[dm.statusBtn, { backgroundColor: style.bg, borderColor: style.color + '50' }, isActive && { borderWidth: 2, borderColor: style.color }]}
                  onPress={() => !isActive && updateStatus(st)}
                  disabled={saving || isActive}
                >
                  <Text style={{ fontSize: 16 }}>{style.emoji}</Text>
                  <Text style={[dm.statusBtnTxt, { color: style.color }]}>{style.label}</Text>
                  {isActive && <Text style={[dm.currentTxt, { color: style.color }]}>Current</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {saving && <ActivityIndicator color={C.blue} style={{ marginTop: 10 }} />}
        </View>
      </View>
    </Modal>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [selected,   setSelected]   = useState(null);
  const [showModal,  setShowModal]  = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        users (id, email, campus_preference, role),
        nodes (node_id, location_name, campus)
      `)
      .order('created_at', { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, []);

  const handleStatusChange = (reportId, newStatus) => {
    setReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r)
    );
    setSelected(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const deleteReport = (report) => {
    Alert.alert('Delete Report', 'Delete this report permanently?', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await supabase.from('reports').delete().eq('id', report.id);
        setReports(prev => prev.filter(r => r.id !== report.id));
        setShowModal(false);
      }},
    ]);
  };

  const filtered = reports.filter(r => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchSearch =
      r.users?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.nodes?.location_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.issue_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all:           reports.length,
    open:          reports.filter(r => r.status === 'open').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    resolved:      reports.filter(r => r.status === 'resolved').length,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>📝 Reports</Text>
        <Text style={s.count}>{reports.length} total</Text>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        {Object.entries(STATUS_STYLES).map(([key, style]) => (
          <View key={key} style={[s.statItem, { borderColor: style.color + '30' }]}>
            <Text style={[s.statNum, { color: style.color }]}>{counts[key] || 0}</Text>
            <Text style={s.statLbl}>{style.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Text style={{ fontSize:14, color:C.text2 }}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by user, node, issue..."
          placeholderTextColor={C.text2}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color:C.text2, fontSize:16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsWrap} contentContainerStyle={{ paddingHorizontal:14, gap:6 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.chip, filter === f && s.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.chipTxt, filter === f && s.chipTxtActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop:40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding:14, gap:8, paddingBottom:40 }}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize:36 }}>📝</Text>
              <Text style={s.emptyTxt}>No reports found</Text>
            </View>
          ) : (
            filtered.map(report => {
              const ss    = STATUS_STYLES[report.status] || STATUS_STYLES.open;
              const issue = ISSUE_LABELS[report.issue_type] || { label:report.issue_type, emoji:'📝' };
              return (
                <TouchableOpacity
                  key={report.id}
                  style={s.card}
                  onPress={() => { setSelected(report); setShowModal(true); }}
                  activeOpacity={0.8}
                >
                  <View style={s.cardHead}>
                    <View style={s.issueIcon}>
                      <Text style={{ fontSize:20 }}>{issue.emoji}</Text>
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={s.issueName}>{issue.label}</Text>
                      <Text style={s.nodeName}>
                        📡 {report.nodes?.location_name || 'Unknown node'}
                      </Text>
                      <Text style={s.userName}>
                        👤 {report.users?.email || 'Anonymous'}
                      </Text>
                    </View>
                    <View style={{ alignItems:'flex-end', gap:4 }}>
                      <View style={[s.statusBadge, { backgroundColor:ss.bg }]}>
                        <Text style={[s.statusTxt, { color:ss.color }]}>{ss.emoji} {ss.label}</Text>
                      </View>
                      <Text style={s.timeAgo}>
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix:true })}
                      </Text>
                    </View>
                  </View>

                  {report.description && (
                    <Text style={s.desc} numberOfLines={2}>{report.description}</Text>
                  )}

                  {/* Quick status buttons */}
                  <View style={s.quickStatus}>
                    {STATUSES.map(st => {
                      const stStyle = STATUS_STYLES[st];
                      const isActive = report.status === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[s.quickBtn, { backgroundColor: stStyle.bg }, isActive && { borderWidth:1.5, borderColor:stStyle.color }]}
                          onPress={async (e) => {
                            e.stopPropagation?.();
                            if (isActive) return;
                            await supabase.from('reports').update({ status:st }).eq('id', report.id);
                            handleStatusChange(report.id, st);
                          }}
                        >
                          <Text style={{ fontSize:10 }}>{stStyle.emoji}</Text>
                          <Text style={[s.quickBtnTxt, { color:stStyle.color }]}>{stStyle.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <ReportDetailModal
        visible={showModal}
        report={selected}
        onClose={() => { setShowModal(false); setSelected(null); }}
        onStatusChange={handleStatusChange}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex:1, backgroundColor:C.bg0 },
  header:     { backgroundColor:C.bg1, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:C.border },
  back:       { fontSize:14, fontWeight:'600', color:C.blueLight },
  title:      { fontSize:16, fontWeight:'700', color:C.text0 },
  count:      { fontSize:12, color:C.text2 },
  statsRow:   { flexDirection:'row', gap:8, padding:12, paddingBottom:4 },
  statItem:   { flex:1, backgroundColor:C.bg2, borderRadius:10, padding:10, alignItems:'center', borderWidth:1 },
  statNum:    { fontSize:20, fontWeight:'700' },
  statLbl:    { fontSize:9, color:C.text2, marginTop:2 },
  searchBar:  { flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:12, marginVertical:6, backgroundColor:C.bg2, borderRadius:10, padding:10, borderWidth:1, borderColor:C.border },
  searchInput:{ flex:1, fontSize:13, color:C.text0 },
  chipsWrap:  { paddingVertical:6, maxHeight:46 },
  chip:       { paddingHorizontal:12, paddingVertical:5, borderRadius:20, backgroundColor:C.bg2, borderWidth:1, borderColor:C.border },
  chipActive: { backgroundColor:'rgba(59,130,246,0.2)', borderColor:'rgba(59,130,246,0.5)' },
  chipTxt:    { fontSize:11, fontWeight:'600', color:C.text1 },
  chipTxtActive:{ color:C.blueLight },
  card:       { backgroundColor:C.bg2, borderRadius:12, padding:14, borderWidth:1, borderColor:C.border },
  cardHead:   { flexDirection:'row', gap:10, alignItems:'flex-start', marginBottom:8 },
  issueIcon:  { width:40, height:40, borderRadius:10, backgroundColor:C.bg3, alignItems:'center', justifyContent:'center' },
  issueName:  { fontSize:14, fontWeight:'700', color:C.text0 },
  nodeName:   { fontSize:11, color:C.text2, marginTop:2 },
  userName:   { fontSize:11, color:C.text2, marginTop:1 },
  statusBadge:{ paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  statusTxt:  { fontSize:10, fontWeight:'700' },
  timeAgo:    { fontSize:10, color:C.text2 },
  desc:       { fontSize:12, color:C.text1, lineHeight:17, marginBottom:8 },
  quickStatus:{ flexDirection:'row', gap:6 },
  quickBtn:   { flex:1, borderRadius:8, padding:6, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:4 },
  quickBtnTxt:{ fontSize:10, fontWeight:'600' },
  empty:      { alignItems:'center', paddingTop:60, gap:10 },
  emptyTxt:   { fontSize:14, color:C.text2 },
});

const dm = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' },
  sheet:        { backgroundColor:C.bg1, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:50, maxHeight:'90%' },
  sheetHead:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  sheetTitle:   { fontSize:18, fontWeight:'700', color:C.text0 },
  closeBtn:     { fontSize:18, color:C.text2, padding:4 },
  section:      { marginBottom:16 },
  sectionLabel: { fontSize:10, fontWeight:'700', color:C.text2, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 },
  issueRow:     { flexDirection:'row', alignItems:'center', gap:10 },
  issueName:    { fontSize:16, fontWeight:'700', color:C.text0 },
  statusBadge:  { paddingHorizontal:12, paddingVertical:6, borderRadius:10, alignSelf:'flex-start' },
  statusTxt:    { fontSize:14, fontWeight:'700' },
  infoBox:      { backgroundColor:C.bg2, borderRadius:10, padding:12, gap:6, borderWidth:1, borderColor:C.border },
  infoRow:      { fontSize:13, color:C.text1 },
  descBox:      { backgroundColor:C.bg2, borderRadius:10, padding:12, borderWidth:1, borderColor:C.border },
  descTxt:      { fontSize:13, color:C.text1, lineHeight:19 },
  time:         { fontSize:11, color:C.text2, marginBottom:16 },
  statusBtns:   { flexDirection:'row', gap:8 },
  statusBtn:    { flex:1, borderRadius:10, padding:10, alignItems:'center', gap:4, borderWidth:1, borderColor:'transparent' },
  statusBtnTxt: { fontSize:11, fontWeight:'700' },
  currentTxt:   { fontSize:9, fontWeight:'600', opacity:0.7 },
});
