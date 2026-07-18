// app/app/admin/nodes.js — Node Management (CRUD)
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const CAMPUSES = ['UJ APK', 'UJ APB', 'UJ SWC', 'UJ DFC'];
const STATUSES = ['online', 'offline', 'maintenance'];

const EMPTY_NODE = {
  campus: 'UJ APK',
  location_name: '',
  latitude: '',
  longitude: '',
  status: 'online',
};

function NodeModal({ visible, node, onClose, onSave }) {
  const [form,   setForm]   = useState(EMPTY_NODE);
  const [saving, setSaving] = useState(false);
  const isEdit = !!node?.node_id;

  useEffect(() => {
    if (node) {
      setForm({
        campus:        node.campus        || 'UJ APK',
        location_name: node.location_name || '',
        latitude:      node.latitude?.toString()  || '',
        longitude:     node.longitude?.toString() || '',
        status:        node.status        || 'online',
      });
    } else {
      setForm(EMPTY_NODE);
    }
  }, [node]);

  const save = async () => {
    if (!form.location_name.trim()) {
      Alert.alert('Error', 'Location name is required'); return;
    }
    if (!form.latitude || !form.longitude) {
      Alert.alert('Error', 'Latitude and longitude are required'); return;
    }
    setSaving(true);

    const payload = {
      campus:        form.campus,
      location_name: form.location_name.trim(),
      latitude:      parseFloat(form.latitude),
      longitude:     parseFloat(form.longitude),
      status:        form.status,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('nodes').update(payload).eq('node_id', node.node_id));
    } else {
      ({ error } = await supabase.from('nodes').insert(payload));
    }

    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <ScrollView>
          <View style={m.sheet}>
            <Text style={m.title}>{isEdit ? '✏️ Edit Node' : '➕ Add Node'}</Text>

            <Text style={m.label}>Campus</Text>
            <View style={m.optionRow}>
              {CAMPUSES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[m.option, form.campus === c && m.optionActive]}
                  onPress={() => setForm(f => ({ ...f, campus: c }))}
                >
                  <Text style={[m.optionTxt, form.campus === c && m.optionTxtActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={m.label}>Location Name</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. Library Entrance Fountain"
              placeholderTextColor={C.text2}
              value={form.location_name}
              onChangeText={v => setForm(f => ({ ...f, location_name: v }))}
            />

            <View style={m.row}>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Latitude</Text>
                <TextInput
                  style={m.input}
                  placeholder="-26.1849"
                  placeholderTextColor={C.text2}
                  value={form.latitude}
                  onChangeText={v => setForm(f => ({ ...f, latitude: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>Longitude</Text>
                <TextInput
                  style={m.input}
                  placeholder="28.0002"
                  placeholderTextColor={C.text2}
                  value={form.longitude}
                  onChangeText={v => setForm(f => ({ ...f, longitude: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={m.label}>Status</Text>
            <View style={m.optionRow}>
              {STATUSES.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[m.option, form.status === st && m.optionActive]}
                  onPress={() => setForm(f => ({ ...f, status: st }))}
                >
                  <Text style={[m.optionTxt, form.status === st && m.optionTxtActive]}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={save} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={m.saveTxt}>{isEdit ? 'Save Changes' : 'Add Node'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function NodesScreen() {
  const router = useRouter();
  const [nodes,      setNodes]     = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [search,     setSearch]    = useState('');
  const [editNode,   setEditNode]  = useState(null);
  const [showModal,  setShowModal] = useState(false);
  const [filterCampus, setFilterCampus] = useState('All');

  const fetchNodes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nodes')
      .select('*')
      .order('campus')
      .order('location_name');
    setNodes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNodes(); }, []);

  const deleteNode = (node) => {
    Alert.alert(
      'Delete Node',
      `Delete "${node.location_name}"? All readings and alerts for this node will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('nodes').delete().eq('node_id', node.node_id);
            fetchNodes();
          },
        },
      ]
    );
  };

  const toggleStatus = async (node) => {
    const newStatus = node.status === 'online' ? 'offline' : 'online';
    await supabase.from('nodes').update({ status: newStatus }).eq('node_id', node.node_id);
    setNodes(prev => prev.map(n => n.node_id === node.node_id ? { ...n, status: newStatus } : n));
  };

  const STATUS_COLOR = { online: C.green, offline: C.red, maintenance: C.amber };
  const campuses = ['All', ...CAMPUSES];

  const filtered = nodes.filter(n => {
    const matchSearch = n.location_name?.toLowerCase().includes(search.toLowerCase()) ||
                        n.campus?.toLowerCase().includes(search.toLowerCase());
    const matchCampus = filterCampus === 'All' || n.campus === filterCampus;
    return matchSearch && matchCampus;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>📡 Node Management</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditNode(null); setShowModal(true); }}
        >
          <Text style={s.addBtnTxt}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Text style={{ fontSize: 14, color: C.text2 }}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search nodes..."
          placeholderTextColor={C.text2}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Campus filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsWrap} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
        {campuses.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.chip, filterCampus === c && s.chipActive]}
            onPress={() => setFilterCampus(c)}
          >
            <Text style={[s.chipTxt, filterCampus === c && s.chipTxtActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}>
          {filtered.map(node => (
            <View key={node.node_id} style={s.card}>
              <View style={s.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nodeName}>{node.location_name}</Text>
                  <Text style={s.nodeMeta}>{node.campus}</Text>
                  <Text style={s.nodeCoords}>
                    📍 {node.latitude?.toFixed(4)}, {node.longitude?.toFixed(4)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[node.status] + '20' }]}>
                    <Text style={[s.statusTxt, { color: STATUS_COLOR[node.status] }]}>
                      {node.status}
                    </Text>
                  </View>
                  <Switch
                    value={node.status === 'online'}
                    onValueChange={() => toggleStatus(node)}
                    trackColor={{ false: C.bg3, true: C.green }}
                    thumbColor="white"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              </View>

              <Text style={s.nodeId}>ID: {node.node_id}</Text>

              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => { setEditNode(node); setShowModal(true); }}
                >
                  <Text style={s.editBtnTxt}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => deleteNode(node)}
                >
                  <Text style={s.deleteBtnTxt}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={{ fontSize: 36 }}>📡</Text>
              <Text style={s.emptyTxt}>No nodes found</Text>
            </View>
          )}
        </ScrollView>
      )}

      <NodeModal
        visible={showModal}
        node={editNode}
        onClose={() => { setShowModal(false); setEditNode(null); }}
        onSave={() => { setShowModal(false); setEditNode(null); fetchNodes(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { backgroundColor: C.bg1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  back:       { fontSize: 14, fontWeight: '600', color: C.blueLight },
  title:      { fontSize: 16, fontWeight: '700', color: C.text0 },
  addBtn:     { backgroundColor: 'rgba(59,130,246,0.2)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
  addBtnTxt:  { fontSize: 13, fontWeight: '700', color: C.blueLight },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 4, backgroundColor: C.bg2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border },
  searchInput:{ flex: 1, fontSize: 13, color: C.text0 },
  chipsWrap:  { paddingVertical: 8, maxHeight: 48 },
  chip:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: 'rgba(59,130,246,0.5)' },
  chipTxt:    { fontSize: 12, fontWeight: '600', color: C.text1 },
  chipTxtActive: { color: C.blueLight },
  card:       { backgroundColor: C.bg2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  cardHead:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  nodeName:   { fontSize: 14, fontWeight: '700', color: C.text0 },
  nodeMeta:   { fontSize: 12, color: C.text2, marginTop: 2 },
  nodeCoords: { fontSize: 11, color: C.text2, marginTop: 2 },
  nodeId:     { fontSize: 10, color: C.text2, fontFamily: 'monospace', marginBottom: 10 },
  statusBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt:  { fontSize: 11, fontWeight: '700' },
  cardActions:{ flexDirection: 'row', gap: 8 },
  editBtn:    { flex: 1, backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  editBtnTxt: { fontSize: 12, fontWeight: '600', color: C.blueLight },
  deleteBtn:  { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  deleteBtnTxt:{ fontSize: 12, fontWeight: '600', color: C.red },
  empty:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:   { fontSize: 14, color: C.text2 },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.bg1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 50 },
  title:      { fontSize: 18, fontWeight: '700', color: C.text0, marginBottom: 20 },
  label:      { fontSize: 11, fontWeight: '700', color: C.text1, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:      { backgroundColor: C.bg2, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, fontSize: 13, color: C.text0, marginBottom: 16 },
  row:        { flexDirection: 'row', gap: 10 },
  optionRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  option:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  optionActive:{ backgroundColor: 'rgba(59,130,246,0.2)', borderColor: C.blue },
  optionTxt:  { fontSize: 12, fontWeight: '500', color: C.text1 },
  optionTxtActive: { color: C.blueLight },
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:  { flex: 1, backgroundColor: C.bg2, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelTxt:  { fontSize: 14, fontWeight: '600', color: C.text1 },
  saveBtn:    { flex: 1, backgroundColor: C.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveTxt:    { fontSize: 14, fontWeight: '700', color: 'white' },
});
