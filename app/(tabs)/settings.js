// app/(tabs)/settings.js — Full Settings Screen
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const CAMPUSES = ['UJ APK','UJ APB','UJ SWC','UJ DFC'];

const DEFAULT_THRESHOLDS = {
  ph_min:5.0, ph_max:9.7, tds_max:1200, turbidity_max:5, temp_min:5, temp_max:25,
};

function SectionLabel({ title }) {
  return <Text style={s.sectionLabel}>{title}</Text>;
}

function Row({ icon, label, subtitle, right, onPress, danger }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.iconBox, danger && { backgroundColor:'rgba(239,68,68,0.15)' }]}>
        <Text style={{ fontSize:18 }}>{icon}</Text>
      </View>
      <View style={{ flex:1 }}>
        <Text style={[s.rowLabel, danger && { color:C.red }]}>{label}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </Wrap>
  );
}

function ThresholdModal({ visible, thresholds, onClose, onSave }) {
  const [vals, setVals] = useState(thresholds);
  useEffect(() => setVals(thresholds), [thresholds]);

  const fields = [
    { key:'ph_min',        label:'pH Minimum',        unit:'',     step:0.1 },
    { key:'ph_max',        label:'pH Maximum',        unit:'',     step:0.1 },
    { key:'tds_max',       label:'TDS Maximum',       unit:'mg/L', step:50  },
    { key:'turbidity_max', label:'Turbidity Maximum', unit:'NTU',  step:0.5 },
    { key:'temp_min',      label:'Temperature Min',   unit:'°C',   step:1   },
    { key:'temp_max',      label:'Temperature Max',   unit:'°C',   step:1   },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tm.overlay}>
        <View style={tm.sheet}>
          <Text style={tm.title}>⚗️ SANS 241:2015 Thresholds</Text>
          <Text style={tm.sub}>Customise alert trigger values</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight:340 }}>
            {fields.map(f => (
              <View key={f.key} style={tm.fieldRow}>
                <Text style={tm.fieldLabel}>{f.label}</Text>
                <View style={tm.controls}>
                  <TouchableOpacity style={tm.btn} onPress={() => setVals(v => ({ ...v, [f.key]: parseFloat(Math.max(0, v[f.key] - f.step).toFixed(1)) }))}>
                    <Text style={tm.btnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={tm.val}>{vals[f.key]}{f.unit}</Text>
                  <TouchableOpacity style={tm.btn} onPress={() => setVals(v => ({ ...v, [f.key]: parseFloat((v[f.key] + f.step).toFixed(1)) }))}>
                    <Text style={tm.btnTxt}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={tm.btnRow}>
            <TouchableOpacity style={tm.cancelBtn} onPress={onClose}>
              <Text style={tm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tm.saveBtn} onPress={() => onSave(vals)}>
              <Text style={tm.saveTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile,      setProfile]      = useState(null);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [campus,       setCampus]       = useState('UJ APK');
  const [saving,       setSaving]       = useState(false);
  const [pushNotifs,   setPushNotifs]   = useState(true);
  const [emailDigest,  setEmailDigest]  = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [thresholds,   setThresholds]   = useState(DEFAULT_THRESHOLDS);
  const [showThresh,   setShowThresh]   = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setIsAdmin(data.role === 'admin');
          setCampus(data.campus_preference || 'UJ APK');
        }
        setLoading(false);
      });
  }, [user]);

  const saveCampus = async (c) => {
    setCampus(c);
    setSaving(true);
    await supabase.from('users').update({ campus_preference: c }).eq('id', user.id);
    setSaving(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text:'Cancel', style:'cancel' },
      { text:'Sign Out', style:'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={C.blue} style={{ marginTop:60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Profile header */}
      <View style={s.profileHead}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>
            {(profile?.email || user?.email || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={s.profileName}>{profile?.email?.split('@')[0] || 'User'}</Text>
          <Text style={s.profileEmail}>{profile?.email || user?.email}</Text>
          <View style={[s.badge, { backgroundColor: isAdmin ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.15)' }]}>
            <Text style={[s.badgeTxt, { color: isAdmin ? '#a78bfa' : C.blueLight }]}>
              {isAdmin ? '⚙️ Admin' : '🎓 Student'} · {campus}
            </Text>
          </View>
        </View>
        {saving && <ActivityIndicator size="small" color={C.blue} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:50 }}>

        {/* Campus */}
        <SectionLabel title="MY CAMPUS" />
        <View style={s.section}>
          <View style={s.campusGrid}>
            {CAMPUSES.map(c => (
              <TouchableOpacity key={c} style={[s.campusChip, campus===c && s.campusChipOn]} onPress={() => saveCampus(c)}>
                <Text style={[s.campusChipTxt, campus===c && s.campusChipTxtOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <SectionLabel title="NOTIFICATIONS" />
        <View style={s.section}>
          <Row icon="🔔" label="Push Notifications" subtitle="Real-time water quality alerts"
            right={<Switch value={pushNotifs} onValueChange={setPushNotifs} trackColor={{ false:C.bg3, true:C.blue }} thumbColor="white"/>}/>
          <View style={s.div}/>
          <Row icon="📧" label="Email Digests" subtitle="Daily summary of campus readings"
            right={<Switch value={emailDigest} onValueChange={setEmailDigest} trackColor={{ false:C.bg3, true:C.blue }} thumbColor="white"/>}/>
          <View style={s.div}/>
          <Row icon="🚨" label="SMS Critical Alerts" subtitle="SMS for UNSAFE readings only"
            right={<Switch value={criticalOnly} onValueChange={setCriticalOnly} trackColor={{ false:C.bg3, true:C.red }} thumbColor="white"/>}/>
          <View style={s.div}/>
          <Row icon="🔕" label="Critical Only Mode" subtitle="Suppress CAUTION notifications"
            right={<Switch value={criticalOnly} onValueChange={setCriticalOnly} trackColor={{ false:C.bg3, true:C.amber }} thumbColor="white"/>}/>
        </View>

        {/* Thresholds */}
        <SectionLabel title="THRESHOLDS" />
        <View style={s.section}>
          <Row icon="⚗️" label="pH Range" subtitle={`${thresholds.ph_min} – ${thresholds.ph_max}`}
            right={<Text style={s.chevron}>›</Text>} onPress={() => setShowThresh(true)}/>
          <View style={s.div}/>
          <Row icon="⚡" label="TDS Max" subtitle={`${thresholds.tds_max} mg/L`}
            right={<Text style={s.chevron}>›</Text>} onPress={() => setShowThresh(true)}/>
          <View style={s.div}/>
          <Row icon="🌡️" label="Temperature Max" subtitle={`${thresholds.temp_max}°C`}
            right={<Text style={s.chevron}>›</Text>} onPress={() => setShowThresh(true)}/>
          <View style={s.div}/>
          <Row icon="💡" label="Turbidity Max" subtitle={`${thresholds.turbidity_max} NTU`}
            right={<Text style={s.chevron}>›</Text>} onPress={() => setShowThresh(true)}/>
          <View style={s.div}/>
          <Row icon="🔄" label="Reset to SANS 241:2015 Defaults"
            right={<Text style={s.chevron}>›</Text>}
            onPress={() => Alert.alert('Reset','Restore all thresholds to SANS 241:2015 defaults?',[
              {text:'Cancel',style:'cancel'},
              {text:'Reset',onPress:()=>setThresholds(DEFAULT_THRESHOLDS)},
            ])}/>
        </View>

        {/* Integrations */}
        <SectionLabel title="INTEGRATIONS" />
        <View style={s.section}>
          <Row icon="🌐" label="Web Dashboard" subtitle="aquasense-uj.supabase.co"
            right={<Text style={s.linked}>Linked ✓</Text>}/>
          <View style={s.div}/>
          <Row icon="🔗" label="API Access" subtitle="REST + WebSocket"
            right={<Text style={s.chevron}>›</Text>}
            onPress={() => Alert.alert('API Access',`Supabase URL:\n${process.env.EXPO_PUBLIC_SUPABASE_URL}`)}/>
          <View style={s.div}/>
          <Row icon="📊" label="Export Data" subtitle="CSV · PDF reports"
            right={<Text style={s.chevron}>›</Text>}
            onPress={() => Alert.alert('Export Data','Data export coming in next release.')}/>
        </View>

        {/* About */}
        <SectionLabel title="ABOUT" />
        <View style={s.section}>
          <Row icon="📋" label="SANS 241:2015" subtitle="South African drinking water standard"
            right={<Text style={s.chevron}>›</Text>}
            onPress={() => Alert.alert('SANS 241:2015','pH: 5.0–9.7\nTDS: ≤1200 mg/L\nTurbidity: ≤5 NTU\nTemperature: 5–25°C')}/>
          <View style={s.div}/>
          <Row icon="💧" label="AquaSense UJ" subtitle="Version 1.0.0 · University of Johannesburg"/>
        </View>

        <SectionLabel title="REPORT AN ISSUE" />
        <View style={s.section}>
          <Row
            icon="📝"
            label="Submit Water Issue Report"
            subtitle="Report a problem at a water point"
            right={<Text style={s.chevron}>›</Text>}
            onPress={() => router.push('/report')}
          />
        </View>

        {/* Sign out */}
        <SectionLabel title="ACCOUNT" />
        <View style={s.section}>
          <Row icon="🚪" label="Sign Out" subtitle="Return to login screen"
            danger onPress={handleSignOut}/>
        </View>

      </ScrollView>

      <ThresholdModal
        visible={showThresh}
        thresholds={thresholds}
        onClose={() => setShowThresh(false)}
        onSave={(v) => { setThresholds(v); setShowThresh(false); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex:1, backgroundColor:'#0a0e1a' },
  profileHead: { backgroundColor:'#0f1525', padding:20, flexDirection:'row', alignItems:'center', gap:14, borderBottomWidth:1, borderBottomColor:'#1e2d47' },
  avatar:      { width:56, height:56, borderRadius:28, backgroundColor:'rgba(59,130,246,0.25)', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'rgba(59,130,246,0.4)' },
  avatarTxt:   { fontSize:22, fontWeight:'700', color:'#60a5fa' },
  profileName: { fontSize:17, fontWeight:'700', color:'#f1f5f9', marginBottom:2 },
  profileEmail:{ fontSize:12, color:'#475569', marginBottom:6 },
  badge:       { paddingHorizontal:10, paddingVertical:3, borderRadius:20, alignSelf:'flex-start' },
  badgeTxt:    { fontSize:11, fontWeight:'700' },
  sectionLabel:{ fontSize:10, fontWeight:'700', color:'#475569', textTransform:'uppercase', letterSpacing:0.8, paddingHorizontal:16, paddingTop:20, paddingBottom:8 },
  section:     { backgroundColor:'#151c30', marginHorizontal:14, borderRadius:14, borderWidth:1, borderColor:'#1e2d47', overflow:'hidden' },
  row:         { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:14, paddingVertical:13 },
  iconBox:     { width:34, height:34, borderRadius:8, backgroundColor:'#1c2540', alignItems:'center', justifyContent:'center' },
  rowLabel:    { fontSize:14, fontWeight:'500', color:'#f1f5f9' },
  rowSub:      { fontSize:11, color:'#475569', marginTop:1 },
  div:         { height:1, backgroundColor:'#1e2d47', marginLeft:60 },
  chevron:     { fontSize:20, color:'#475569' },
  linked:      { fontSize:12, fontWeight:'600', color:'#22c55e' },
  campusGrid:  { flexDirection:'row', flexWrap:'wrap', gap:8, padding:14 },
  campusChip:  { paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'#1c2540', borderWidth:1, borderColor:'#1e2d47' },
  campusChipOn:{ backgroundColor:'rgba(59,130,246,0.2)', borderColor:'#3b82f6' },
  campusChipTxt:{ fontSize:12, fontWeight:'600', color:'#94a3b8' },
  campusChipTxtOn:{ color:'#60a5fa' },
});

const tm = StyleSheet.create({
  overlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' },
  sheet:     { backgroundColor:'#0f1525', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:44 },
  title:     { fontSize:18, fontWeight:'700', color:'#f1f5f9', marginBottom:4 },
  sub:       { fontSize:12, color:'#475569', marginBottom:20 },
  fieldRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#1e2d47' },
  fieldLabel:{ fontSize:14, color:'#f1f5f9', fontWeight:'500' },
  controls:  { flexDirection:'row', alignItems:'center', gap:10 },
  btn:       { width:32, height:32, backgroundColor:'#151c30', borderRadius:8, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#1e2d47' },
  btnTxt:    { fontSize:16, color:'#f1f5f9', fontWeight:'600', lineHeight:20 },
  val:       { fontSize:15, fontWeight:'700', color:'#60a5fa', minWidth:72, textAlign:'center' },
  btnRow:    { flexDirection:'row', gap:10, marginTop:20 },
  cancelBtn: { flex:1, backgroundColor:'#151c30', borderRadius:12, padding:14, alignItems:'center', borderWidth:1, borderColor:'#1e2d47' },
  cancelTxt: { fontSize:14, fontWeight:'600', color:'#94a3b8' },
  saveBtn:   { flex:1, backgroundColor:'#3b82f6', borderRadius:12, padding:14, alignItems:'center' },
  saveTxt:   { fontSize:14, fontWeight:'700', color:'white' },
});
