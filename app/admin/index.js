// app/app/admin/index.js — Admin Dashboard Home
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
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

function StatCard({ emoji, label, value, color, onPress }) {
  return (
    <TouchableOpacity style={[s.statCard, { borderColor: color + '40' }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuCard({ emoji, title, subtitle, color, onPress }) {
  return (
    <TouchableOpacity style={s.menuCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.menuIcon, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.menuTitle}>{title}</Text>
        <Text style={s.menuSub}>{subtitle}</Text>
      </View>
      <Text style={s.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats,    setStats]    = useState({ users:0, nodes:0, campuses:0, reports:0, alerts:0, readings:0 });
  const [loading,  setLoading]  = useState(true);
  const [adminUser,setAdminUser]= useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setAdminUser(user);

      const [users, nodes, reports, alerts, readings] = await Promise.all([
        supabase.from('users').select('id', { count:'exact', head:true }),
        supabase.from('nodes').select('id', { count:'exact', head:true }),
        supabase.from('reports').select('id', { count:'exact', head:true }),
        supabase.from('alerts').select('id', { count:'exact', head:true }).is('resolved_at', null),
        supabase.from('readings').select('id', { count:'exact', head:true }),
      ]);

      const { data: campusData } = await supabase
        .from('nodes')
        .select('campus');
      const uniqueCampuses = new Set((campusData || []).map(n => n.campus)).size;

      setStats({
        users:    users.count    || 0,
        nodes:    nodes.count    || 0,
        campuses: uniqueCampuses || 0,
        reports:  reports.count  || 0,
        alerts:   alerts.count   || 0,
        readings: readings.count || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.backTxt}>← App</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>⚙️ Admin Panel</Text>
            <Text style={s.headerSub}>{adminUser?.email}</Text>
          </View>
        </View>
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeTxt}>ADMIN</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Stats grid */}
        <Text style={s.sectionLabel}>OVERVIEW</Text>
        {loading ? (
          <ActivityIndicator color={C.blue} style={{ marginVertical: 20 }} />
        ) : (
          <View style={s.statsGrid}>
            <StatCard emoji="👥" label="Users"    value={stats.users}    color={C.blue}   onPress={() => router.push('/admin/users')} />
            <StatCard emoji="📡" label="Nodes"    value={stats.nodes}    color={C.green}  onPress={() => router.push('/admin/nodes')} />
            <StatCard emoji="🏛️" label="Campuses" value={stats.campuses} color={C.purple} onPress={() => router.push('/admin/campuses')} />
            <StatCard emoji="📝" label="Reports"  value={stats.reports}  color={C.amber}  onPress={() => router.push('/admin/reports')} />
            <StatCard emoji="🚨" label="Alerts"   value={stats.alerts}   color={C.red}    onPress={() => router.push('/(tabs)/alerts')} />
            <StatCard emoji="📊" label="Readings" value={stats.readings}  color={C.blueLight} onPress={() => {}} />
          </View>
        )}

        {/* Menu */}
        <Text style={s.sectionLabel}>MANAGE</Text>
        <View style={s.menuList}>
          <MenuCard
            emoji="👥" color={C.blue}
            title="User Management"
            subtitle="View, edit roles, delete users"
            onPress={() => router.push('/admin/users')}
          />
          <MenuCard
            emoji="📡" color={C.green}
            title="Node Management"
            subtitle="Add, edit, delete sensor nodes"
            onPress={() => router.push('/admin/nodes')}
          />
          <MenuCard
            emoji="🏛️" color={C.purple}
            title="Campus Management"
            subtitle="Manage UJ campus locations"
            onPress={() => router.push('/admin/campuses')}
          />
          <MenuCard
            emoji="📝" color={C.amber}
            title="Reports"
            subtitle="View & update report statuses"
            onPress={() => router.push('/admin/reports')}
          />
        </View>

        {/* Quick actions */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.quickActions}>
          <TouchableOpacity
            style={[s.quickBtn, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }]}
            onPress={async () => {
              await supabase.from('alerts').update({ resolved_at: new Date().toISOString() }).is('resolved_at', null);
              setStats(prev => ({ ...prev, alerts: 0 }));
            }}
          >
            <Text style={{ fontSize: 18 }}>✅</Text>
            <Text style={[s.quickBtnTxt, { color: C.red }]}>Resolve All Alerts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.quickBtn, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.3)' }]}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={{ fontSize: 18 }}>📱</Text>
            <Text style={[s.quickBtnTxt, { color: C.blueLight }]}>Back to App</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { backgroundColor: C.bg1, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:    { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.bg2, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  backTxt:    { fontSize: 12, fontWeight: '600', color: C.blueLight },
  headerTitle:{ fontSize: 18, fontWeight: '700', color: C.text0 },
  headerSub:  { fontSize: 11, color: C.text2, marginTop: 1 },
  adminBadge: { backgroundColor: 'rgba(139,92,246,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' },
  adminBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#a78bfa' },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  statCard:  { width: '30%', flex: 1, backgroundColor: C.bg2, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  statEmoji: { fontSize: 24 },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: C.text2, fontWeight: '500' },

  menuList: { paddingHorizontal: 16, gap: 8 },
  menuCard: { backgroundColor: C.bg2, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  menuIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle:{ fontSize: 14, fontWeight: '700', color: C.text0 },
  menuSub:  { fontSize: 12, color: C.text2, marginTop: 2 },
  menuArrow:{ fontSize: 22, color: C.text2 },

  quickActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  quickBtn:     { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  quickBtnTxt:  { fontSize: 12, fontWeight: '600' },
});
