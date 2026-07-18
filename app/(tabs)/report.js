// app/app/(tabs)/report.js — with admin panel access button
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNodes } from '@/hooks/useNodes';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', purple:'#8b5cf6',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const ISSUE_TYPES = [
  { value:'taste',    label:'Bad Taste',     emoji:'👅' },
  { value:'odour',    label:'Strange Odour', emoji:'👃' },
  { value:'colour',   label:'Discoloured',   emoji:'🎨' },
  { value:'pressure', label:'Low Pressure',  emoji:'💧' },
  { value:'other',    label:'Other Issue',   emoji:'❓' },
];

export default function ReportScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { nodes } = useNodes();
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedNode,   setSelectedNode]   = useState(null);
  const [issueType,      setIssueType]      = useState(null);
  const [description,    setDescription]    = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [submitted,      setSubmitted]      = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('role').eq('id', user.id).single()
      .then(({ data }) => { if (data?.role === 'admin') setIsAdmin(true); });
  }, [user]);

  const canSubmit = selectedNode && issueType;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        user_id:     user?.id,
        node_id:     selectedNode.node_id,
        issue_type:  issueType,
        description: description.trim() || null,
        status:      'open',
      });
      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedNode(null);
        setIssueType(null);
        setDescription('');
      }, 3000);
    } catch (err) {
      Alert.alert('Submission Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.successWrap}>
          <Text style={{ fontSize: 64 }}>✅</Text>
          <Text style={s.successTitle}>Report Submitted!</Text>
          <Text style={s.successDesc}>
            Thank you! Our team will investigate and update the node status.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📝 Report & Account</Text>
          <Text style={s.headerSub}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:100 }}>

        {/* Admin Panel Button — only shown to admins */}
        {isAdmin && (
          <TouchableOpacity
            style={s.adminBtn}
            onPress={() => router.push('/admin')}
          >
            <View style={s.adminBtnLeft}>
              <Text style={{ fontSize:24 }}>⚙️</Text>
              <View>
                <Text style={s.adminBtnTitle}>Admin Dashboard</Text>
                <Text style={s.adminBtnSub}>Manage users, nodes, campuses & reports</Text>
              </View>
            </View>
            <Text style={s.adminBtnArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Account info */}
        <View style={s.accountCard}>
          <View style={s.accountRow}>
            <Text style={s.accountLabel}>Email</Text>
            <Text style={s.accountVal}>{user?.email}</Text>
          </View>
          <View style={s.accountRow}>
            <Text style={s.accountLabel}>Role</Text>
            <View style={[s.roleBadge, { backgroundColor: isAdmin ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.15)' }]}>
              <Text style={[s.roleTxt, { color: isAdmin ? '#a78bfa' : C.blueLight }]}>
                {isAdmin ? '⚙️ Admin' : '🎓 Student'}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine}/>
          <Text style={s.dividerTxt}>SUBMIT A WATER ISSUE REPORT</Text>
          <View style={s.dividerLine}/>
        </View>

        {/* Step 1: Select Node */}
        <Text style={s.stepLabel}>1  Select Water Point</Text>
        <TouchableOpacity
          style={s.nodeSelector}
          onPress={() => setShowNodePicker(!showNodePicker)}
        >
          <Text style={selectedNode ? s.nodeSelectorTxt : s.nodeSelectorPlaceholder}>
            {selectedNode ? `📍 ${selectedNode.location_name} · ${selectedNode.campus}` : 'Choose a water point...'}
          </Text>
          <Text style={{ color:C.text2 }}>▾</Text>
        </TouchableOpacity>

        {showNodePicker && (
          <View style={s.nodePicker}>
            {nodes.map(node => (
              <TouchableOpacity
                key={node.node_id}
                style={[s.nodeOption, selectedNode?.node_id === node.node_id && s.nodeOptionActive]}
                onPress={() => { setSelectedNode(node); setShowNodePicker(false); }}
              >
                <Text style={s.nodeOptionTxt}>{node.location_name}</Text>
                <Text style={s.nodeOptionSub}>{node.campus}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Issue type */}
        <Text style={s.stepLabel}>2  Issue Type</Text>
        <View style={s.issueGrid}>
          {ISSUE_TYPES.map(it => (
            <TouchableOpacity
              key={it.value}
              style={[s.issueCard, issueType === it.value && s.issueCardActive]}
              onPress={() => setIssueType(it.value)}
            >
              <Text style={{ fontSize:28 }}>{it.emoji}</Text>
              <Text style={[s.issueLbl, issueType === it.value && s.issueLblActive]}>{it.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 3: Description */}
        <Text style={s.stepLabel}>3  Description <Text style={s.optional}>(optional)</Text></Text>
        <TextInput
          style={s.textArea}
          placeholder="Describe what you noticed..."
          placeholderTextColor={C.text2}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={s.charCount}>{description.length}/500</Text>

        {/* SANS 241 info */}
        <View style={s.infoBox}>
          <Text style={s.infoBoxTitle}>📋 SANS 241:2015 Standards</Text>
          <Text style={s.infoBoxTxt}>
            UJ monitors water quality against South Africa's mandatory standard. Sensors measure pH (5.0–9.7), TDS (≤1200 mg/L), and Turbidity (≤5 NTU) every 15 minutes.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color="white"/>
            : <Text style={s.submitBtnTxt}>Submit Report</Text>
          }
        </TouchableOpacity>

        {!canSubmit && (
          <Text style={s.validationHint}>Select a water point and issue type to submit.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex:1, backgroundColor:C.bg0 },
  header:      { backgroundColor:C.bg1, paddingHorizontal:18, paddingVertical:14, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderBottomColor:C.border },
  headerTitle: { fontSize:18, fontWeight:'700', color:C.text0 },
  headerSub:   { fontSize:12, color:C.text1, marginTop:2 },
  signOutBtn:  { backgroundColor:'rgba(239,68,68,0.1)', borderRadius:8, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(239,68,68,0.3)' },
  signOutTxt:  { fontSize:12, fontWeight:'600', color:C.red },

  adminBtn:     { backgroundColor:'rgba(139,92,246,0.12)', borderRadius:14, padding:16, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16, borderWidth:1, borderColor:'rgba(139,92,246,0.35)' },
  adminBtnLeft: { flexDirection:'row', alignItems:'center', gap:12 },
  adminBtnTitle:{ fontSize:15, fontWeight:'700', color:'#c4b5fd' },
  adminBtnSub:  { fontSize:11, color:C.text2, marginTop:2 },
  adminBtnArrow:{ fontSize:24, color:'#a78bfa' },

  accountCard:  { backgroundColor:C.bg2, borderRadius:12, padding:14, gap:10, borderWidth:1, borderColor:C.border, marginBottom:20 },
  accountRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  accountLabel: { fontSize:12, color:C.text2 },
  accountVal:   { fontSize:13, fontWeight:'500', color:C.text1 },
  roleBadge:    { paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  roleTxt:      { fontSize:12, fontWeight:'700' },

  divider:      { flexDirection:'row', alignItems:'center', gap:10, marginBottom:16 },
  dividerLine:  { flex:1, height:1, backgroundColor:C.border },
  dividerTxt:   { fontSize:10, fontWeight:'700', color:C.text2, letterSpacing:0.6 },

  stepLabel:    { fontSize:12, fontWeight:'700', color:C.text1, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8, marginTop:4 },
  optional:     { fontSize:11, fontWeight:'400', color:C.text2, textTransform:'none' },

  nodeSelector:    { backgroundColor:C.bg2, borderRadius:12, padding:14, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderWidth:1, borderColor:C.border, marginBottom:12 },
  nodeSelectorTxt: { fontSize:13, fontWeight:'500', color:C.text0, flex:1 },
  nodeSelectorPlaceholder: { fontSize:13, color:C.text2, flex:1 },
  nodePicker:      { backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden', marginBottom:12 },
  nodeOption:      { padding:12, borderBottomWidth:1, borderBottomColor:C.border },
  nodeOptionActive:{ backgroundColor:'rgba(59,130,246,0.1)' },
  nodeOptionTxt:   { fontSize:13, fontWeight:'600', color:C.text0 },
  nodeOptionSub:   { fontSize:11, color:C.text2, marginTop:2 },

  issueGrid:     { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12 },
  issueCard:     { width:'30%', backgroundColor:C.bg2, borderRadius:12, padding:12, alignItems:'center', gap:6, borderWidth:1, borderColor:C.border },
  issueCardActive:{ backgroundColor:'rgba(59,130,246,0.15)', borderColor:'rgba(59,130,246,0.5)' },
  issueLbl:      { fontSize:11, fontWeight:'600', color:C.text1, textAlign:'center' },
  issueLblActive:{ color:C.blueLight },

  textArea:      { backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:13, color:C.text0, minHeight:100, marginBottom:4 },
  charCount:     { fontSize:10, color:C.text2, textAlign:'right', marginBottom:12 },

  infoBox:       { backgroundColor:'rgba(59,130,246,0.08)', borderRadius:12, borderWidth:1, borderColor:'rgba(59,130,246,0.2)', padding:14, marginBottom:16 },
  infoBoxTitle:  { fontSize:13, fontWeight:'700', color:C.blueLight, marginBottom:6 },
  infoBoxTxt:    { fontSize:12, color:C.text1, lineHeight:18 },

  submitBtn:         { backgroundColor:C.blue, borderRadius:12, padding:16, alignItems:'center', marginTop:4 },
  submitBtnDisabled: { backgroundColor:C.bg3, opacity:0.6 },
  submitBtnTxt:      { fontSize:15, fontWeight:'700', color:'white' },
  validationHint:    { fontSize:12, color:C.text2, textAlign:'center', marginTop:8 },

  successWrap:  { flex:1, alignItems:'center', justifyContent:'center', padding:40, gap:16 },
  successTitle: { fontSize:24, fontWeight:'700', color:C.text0 },
  successDesc:  { fontSize:14, color:C.text1, textAlign:'center', lineHeight:22 },
});
