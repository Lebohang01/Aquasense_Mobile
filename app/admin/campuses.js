// app/app/admin/campuses.js — Campus Management
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const CAMPUS_COLORS = {
  'UJ APK': C.blue,
  'UJ APB': C.purple,
  'UJ SWC': C.green,
  'UJ DFC': C.amber,
};

const CAMPUS_FULL_NAMES = {
  'UJ APK': 'Auckland Park Kingsway',
  'UJ APB': 'Auckland Park Bunting Road',
  'UJ SWC': 'Soweto Campus',
  'UJ DFC': 'Doornfontein Campus',
};

function AddNodeModal({ visible, campus, onClose, onSave }) {
  const [form, setForm] = useState({ location_name:'', latitude:'', longitude:'', status:'online' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ location_name:'', latitude:'', longitude:'', status:'online' });
  }, [visible]);

  const save = async () => {
    if (!form.location_name.trim()) { Alert.alert('Error','Location name required'); return; }
    if (!form.latitude || !form.longitude) { Alert.alert('Error','Coordinates required'); return; }
    setSaving(true);
    const { error } = await supabase.from('nodes').insert({
      campus,
      location_name: form.location_name.trim(),
      latitude:  parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      status:    form.status,
    });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>➕ Add Node to {campus}</Text>
          <Text style={m.label}>Location Name</Text>
          <TextInput style={m.input} placeholder="e.g. Main Entrance Fountain" placeholderTextColor={C.text2}
            value={form.location_name} onChangeText={v => setForm(f=>({...f,location_name:v}))} />
          <View style={{flexDirection:'row',gap:10}}>
            <View style={{flex:1}}>
              <Text style={m.label}>Latitude</Text>
              <TextInput style={m.input} placeholder="-26.1849" placeholderTextColor={C.text2}
                keyboardType="numeric" value={form.latitude} onChangeText={v=>setForm(f=>({...f,latitude:v}))} />
            </View>
            <View style={{flex:1}}>
              <Text style={m.label}>Longitude</Text>
              <TextInput style={m.input} placeholder="28.0002" placeholderTextColor={C.text2}
                keyboardType="numeric" value={form.longitude} onChangeText={v=>setForm(f=>({...f,longitude:v}))} />
            </View>
          </View>
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.saveBtn} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="white" size="small"/> : <Text style={m.saveTxt}>Add Node</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CampusesScreen() {
  const router = useRouter();
  const [campusData,   setCampusData]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modalCampus,  setModalCampus]  = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [expanded,     setExpanded]     = useState({});

  const fetchData = async () => {
    setLoading(true);
    const { data: nodes } = await supabase
      .from('nodes')
      .select('*')
      .order('campus')
      .order('location_name');

    // Group by campus
    const grouped = {};
    const campusList = ['UJ APK','UJ APB','UJ SWC','UJ DFC'];
    campusList.forEach(c => { grouped[c] = []; });
    (nodes || []).forEach(n => {
      if (grouped[n.campus]) grouped[n.campus].push(n);
      else grouped[n.campus] = [n];
    });

    // Get reading counts per campus
    const result = await Promise.all(
      campusList.map(async (campus) => {
        const nodeIds = (grouped[campus] || []).map(n => n.node_id);
        let readingCount = 0;
        let alertCount   = 0;
        if (nodeIds.length > 0) {
          const { count: rc } = await supabase.from('readings')
            .select('id', { count:'exact', head:true })
            .in('node_id', nodeIds);
          const { count: ac } = await supabase.from('alerts')
            .select('id', { count:'exact', head:true })
            .in('node_id', nodeIds).is('resolved_at', null);
          readingCount = rc || 0;
          alertCount   = ac || 0;
        }
        return { campus, nodes: grouped[campus] || [], readingCount, alertCount };
      })
    );

    setCampusData(result);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const deleteNode = (node) => {
    Alert.alert('Delete Node', `Delete "${node.location_name}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await supabase.from('nodes').delete().eq('node_id', node.node_id);
        fetchData();
      }},
    ]);
  };

  const toggleExpand = (campus) => {
    setExpanded(prev => ({ ...prev, [campus]: !prev[campus] }));
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
          <Text style={s.title}>🏛️ Campus Management</Text>
          <View style={{width:50}}/>
        </View>
        <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>🏛️ Campus Management</Text>
        <View style={{width:50}}/>
      </View>

      <ScrollView contentContainerStyle={{ padding:14, gap:12, paddingBottom:40 }}>

        {campusData.map(({ campus, nodes, readingCount, alertCount }) => {
          const color    = CAMPUS_COLORS[campus] || C.blue;
          const isExpanded = expanded[campus];

          return (
            <View key={campus} style={[s.campusCard, { borderColor: color + '40' }]}>
              {/* Campus header */}
              <TouchableOpacity style={s.campusHead} onPress={() => toggleExpand(campus)} activeOpacity={0.8}>
                <View style={[s.campusIcon, { backgroundColor: color + '20' }]}>
                  <Text style={{ fontSize: 22 }}>🏛️</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.campusCode}>{campus}</Text>
                  <Text style={s.campusName}>{CAMPUS_FULL_NAMES[campus]}</Text>
                </View>
                <Text style={[s.chevron, isExpanded && s.chevronOpen]}>▾</Text>
              </TouchableOpacity>

              {/* Campus stats */}
              <View style={s.campusStats}>
                <View style={s.campusStat}>
                  <Text style={[s.campusStatVal, { color }]}>{nodes.length}</Text>
                  <Text style={s.campusStatLbl}>Nodes</Text>
                </View>
                <View style={s.campusStat}>
                  <Text style={[s.campusStatVal, { color: C.blueLight }]}>{readingCount}</Text>
                  <Text style={s.campusStatLbl}>Readings</Text>
                </View>
                <View style={s.campusStat}>
                  <Text style={[s.campusStatVal, { color: alertCount > 0 ? C.red : C.green }]}>{alertCount}</Text>
                  <Text style={s.campusStatLbl}>Alerts</Text>
                </View>
                <View style={s.campusStat}>
                  <Text style={[s.campusStatVal, { color: C.green }]}>
                    {nodes.filter(n => n.status === 'online').length}
                  </Text>
                  <Text style={s.campusStatLbl}>Online</Text>
                </View>
              </View>

              {/* Nodes list (expandable) */}
              {isExpanded && (
                <View style={s.nodesList}>
                  <View style={s.nodesListHeader}>
                    <Text style={s.nodesListTitle}>Monitoring Points</Text>
                    <TouchableOpacity
                      style={[s.addNodeBtn, { borderColor: color + '50', backgroundColor: color + '15' }]}
                      onPress={() => { setModalCampus(campus); setShowModal(true); }}
                    >
                      <Text style={[s.addNodeBtnTxt, { color }]}>＋ Add Node</Text>
                    </TouchableOpacity>
                  </View>

                  {nodes.length === 0 ? (
                    <Text style={s.noNodes}>No nodes yet — add one above</Text>
                  ) : (
                    nodes.map(node => (
                      <View key={node.node_id} style={s.nodeRow}>
                        <View style={[s.nodeStatusDot, {
                          backgroundColor: node.status === 'online' ? C.green : node.status === 'offline' ? C.red : C.amber
                        }]}/>
                        <View style={{ flex:1 }}>
                          <Text style={s.nodeRowName}>{node.location_name}</Text>
                          <Text style={s.nodeRowCoords}>
                            {node.latitude?.toFixed(4)}, {node.longitude?.toFixed(4)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={s.nodeDeleteBtn}
                          onPress={() => deleteNode(node)}
                        >
                          <Text style={s.nodeDeleteTxt}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <AddNodeModal
        visible={showModal}
        campus={modalCampus}
        onClose={() => { setShowModal(false); setModalCampus(null); }}
        onSave={() => { setShowModal(false); setModalCampus(null); fetchData(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor:C.bg0 },
  header:       { backgroundColor:C.bg1, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:C.border },
  back:         { fontSize:14, fontWeight:'600', color:C.blueLight },
  title:        { fontSize:16, fontWeight:'700', color:C.text0 },
  campusCard:   { backgroundColor:C.bg2, borderRadius:14, borderWidth:1, overflow:'hidden' },
  campusHead:   { flexDirection:'row', alignItems:'center', gap:12, padding:14 },
  campusIcon:   { width:44, height:44, borderRadius:12, alignItems:'center', justifyContent:'center' },
  campusCode:   { fontSize:16, fontWeight:'700', color:C.text0 },
  campusName:   { fontSize:12, color:C.text2, marginTop:2 },
  chevron:      { fontSize:16, color:C.text2, transition:'transform 0.2s' },
  chevronOpen:  { transform:[{rotate:'180deg'}] },
  campusStats:  { flexDirection:'row', borderTopWidth:1, borderTopColor:C.border, padding:12, gap:4 },
  campusStat:   { flex:1, alignItems:'center' },
  campusStatVal:{ fontSize:18, fontWeight:'700' },
  campusStatLbl:{ fontSize:10, color:C.text2, marginTop:2 },
  nodesList:    { borderTopWidth:1, borderTopColor:C.border, padding:12, gap:6 },
  nodesListHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  nodesListTitle: { fontSize:12, fontWeight:'700', color:C.text1 },
  addNodeBtn:   { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1 },
  addNodeBtnTxt:{ fontSize:12, fontWeight:'700' },
  noNodes:      { fontSize:12, color:C.text2, textAlign:'center', padding:12 },
  nodeRow:      { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.bg3, borderRadius:8, padding:10 },
  nodeStatusDot:{ width:8, height:8, borderRadius:4, flexShrink:0 },
  nodeRowName:  { fontSize:13, fontWeight:'600', color:C.text0 },
  nodeRowCoords:{ fontSize:10, color:C.text2, marginTop:2 },
  nodeDeleteBtn:{ padding:4 },
  nodeDeleteTxt:{ fontSize:16 },
});

const m = StyleSheet.create({
  overlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'flex-end' },
  sheet:     { backgroundColor:C.bg1, borderTopLeftRadius:20, borderTopRightRadius:20, padding:24, paddingBottom:50 },
  title:     { fontSize:18, fontWeight:'700', color:C.text0, marginBottom:20 },
  label:     { fontSize:11, fontWeight:'700', color:C.text1, textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 },
  input:     { backgroundColor:C.bg2, borderRadius:10, borderWidth:1, borderColor:C.border, padding:12, fontSize:13, color:C.text0, marginBottom:16 },
  btnRow:    { flexDirection:'row', gap:10, marginTop:8 },
  cancelBtn: { flex:1, backgroundColor:C.bg2, borderRadius:12, padding:14, alignItems:'center', borderWidth:1, borderColor:C.border },
  cancelTxt: { fontSize:14, fontWeight:'600', color:C.text1 },
  saveBtn:   { flex:1, backgroundColor:C.blue, borderRadius:12, padding:14, alignItems:'center' },
  saveTxt:   { fontSize:14, fontWeight:'700', color:'white' },
});
