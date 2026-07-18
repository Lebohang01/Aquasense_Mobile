// app/app/admin/users.js — User Management (CRUD)
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
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const ROLES = ['student', 'admin', 'technician'];
const CAMPUSES = ['UJ APK', 'UJ APB', 'UJ SWC', 'UJ DFC'];

function UserModal({ visible, user, onClose, onSave }) {
  const [role,   setRole]   = useState(user?.role || 'student');
  const [campus, setCampus] = useState(user?.campus_preference || 'UJ APK');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(user?.role || 'student');
    setCampus(user?.campus_preference || 'UJ APK');
  }, [user]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ role, campus_preference: campus })
      .eq('id', user.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else onSave();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>Edit User</Text>
          <Text style={m.email}>{user?.email}</Text>

          <Text style={m.label}>Role</Text>
          <View style={m.optionRow}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r}
                style={[m.option, role === r && m.optionActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[m.optionTxt, role === r && m.optionTxtActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Campus Preference</Text>
          <View style={m.optionRow}>
            {CAMPUSES.map(c => (
              <TouchableOpacity
                key={c}
                style={[m.option, campus === c && m.optionActive]}
                onPress={() => setCampus(c)}
              >
                <Text style={[m.optionTxt, campus === c && m.optionTxtActive]}>{c}</Text>
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
                : <Text style={m.saveTxt}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function UsersScreen() {
  const router = useRouter();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [editUser, setEditUser] = useState(null);
  const [showModal,setShowModal]= useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const deleteUser = (user) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.email}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('users').delete().eq('id', user.id);
            await supabase.auth.admin.deleteUser(user.id).catch(() => {});
            fetchUsers();
          },
        },
      ]
    );
  };

  const ROLE_COLOR = { admin:'#a78bfa', technician:C.amber, student:C.blueLight };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase()) ||
    u.campus_preference?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>👥 User Management</Text>
        <Text style={s.count}>{users.length} users</Text>
      </View>

      <View style={s.searchBar}>
        <Text style={{ fontSize: 14, color: C.text2 }}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by email, role, campus..."
          placeholderTextColor={C.text2}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: C.text2, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}>
          {filtered.map(user => (
            <View key={user.id} style={s.card}>
              <View style={s.cardHead}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>
                    {user.email?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.email}>{user.email}</Text>
                  <Text style={s.meta}>
                    {user.campus_preference || 'No campus'} · Joined {
                      user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'
                    }
                  </Text>
                </View>
                <View style={[s.roleBadge, { backgroundColor: (ROLE_COLOR[user.role] || C.text2) + '20' }]}>
                  <Text style={[s.roleTxt, { color: ROLE_COLOR[user.role] || C.text2 }]}>
                    {user.role || 'student'}
                  </Text>
                </View>
              </View>

              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => { setEditUser(user); setShowModal(true); }}
                >
                  <Text style={s.editBtnTxt}>✏️ Edit Role</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => deleteUser(user)}
                >
                  <Text style={s.deleteBtnTxt}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={{ fontSize: 36 }}>👥</Text>
              <Text style={s.emptyTxt}>No users found</Text>
            </View>
          )}
        </ScrollView>
      )}

      <UserModal
        visible={showModal}
        user={editUser}
        onClose={() => { setShowModal(false); setEditUser(null); }}
        onSave={() => { setShowModal(false); setEditUser(null); fetchUsers(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { backgroundColor: C.bg1, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  back:       { fontSize: 14, fontWeight: '600', color: C.blueLight },
  title:      { fontSize: 16, fontWeight: '700', color: C.text0 },
  count:      { fontSize: 12, color: C.text2 },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: C.bg2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border },
  searchInput:{ flex: 1, fontSize: 13, color: C.text0 },
  card:       { backgroundColor: C.bg2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  cardHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { fontSize: 16, fontWeight: '700', color: C.blueLight },
  email:      { fontSize: 13, fontWeight: '600', color: C.text0 },
  meta:       { fontSize: 11, color: C.text2, marginTop: 2 },
  roleBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleTxt:    { fontSize: 11, fontWeight: '700' },
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
  sheet:      { backgroundColor: C.bg1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:      { fontSize: 18, fontWeight: '700', color: C.text0, marginBottom: 4 },
  email:      { fontSize: 13, color: C.text2, marginBottom: 20 },
  label:      { fontSize: 12, fontWeight: '600', color: C.text1, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  optionRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  option:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border },
  optionActive:{ backgroundColor: 'rgba(59,130,246,0.2)', borderColor: C.blue },
  optionTxt:  { fontSize: 13, fontWeight: '500', color: C.text1 },
  optionTxtActive: { color: C.blueLight },
  btnRow:     { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:  { flex: 1, backgroundColor: C.bg2, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  cancelTxt:  { fontSize: 14, fontWeight: '600', color: C.text1 },
  saveBtn:    { flex: 1, backgroundColor: C.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveTxt:    { fontSize: 14, fontWeight: '700', color: 'white' },
});
