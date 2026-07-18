// app/app/(auth)/login.js
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const CAMPUSES = ['APK','DFC','SWC','Doornfontein'];

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [campus,   setCampus]   = useState('APK');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email.trim(), password, campus);
        if (error) throw error;
        Alert.alert('Account Created', 'Check your email to confirm, then sign in.',
          [{ text:'OK', onPress:() => setMode('login') }]);
      }
    } catch (err) {
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Sign Up Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1 }} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={s.hero}>
            <View style={s.logoWrap}>
              <View style={s.logoIcon}><Text style={{ fontSize:44 }}>💧</Text></View>
            </View>
            <Text style={s.appName}>AquaSense UJ</Text>
            <Text style={s.tagline}>SANS 241:2015 Water Quality Monitor</Text>
            <View style={s.chipRow}>
              {['pH','TDS','Turbidity','Temp'].map((l,i) => (
                <View key={l} style={s.statusChip}>
                  <View style={[s.statusDot, { backgroundColor: i===0 ? C.red : C.green }]} />
                  <Text style={s.statusChipTxt}>{l}</Text>
                </View>
              ))}
            </View>
            <Text style={s.heroDesc}>Real-time drinking water monitoring across UJ campuses</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            {/* Mode toggle */}
            <View style={s.modeToggle}>
              {['login','signup'].map(m => (
                <TouchableOpacity key={m}
                  style={[s.modeBtn, mode===m && s.modeBtnActive]}
                  onPress={() => setMode(m)}>
                  <Text style={[s.modeBtnTxt, mode===m && s.modeBtnTxtActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.formTitle}>
              {mode === 'login' ? 'Welcome back' : 'Join AquaSense UJ'}
            </Text>

            {/* Email */}
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="student@uj.ac.za"
                placeholderTextColor={C.text2}
                value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Password</Text>
              <View style={s.passRow}>
                <TextInput
                  style={[s.input, { flex:1, marginBottom:0 }]}
                  placeholder="••••••••"
                  placeholderTextColor={C.text2}
                  value={password} onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  onSubmitEditing={handleAuth}
                />
                <TouchableOpacity style={s.showBtn} onPress={() => setShowPass(!showPass)}>
                  <Text style={s.showBtnTxt}>{showPass ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Campus (signup only) */}
            {mode === 'signup' && (
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>My Campus</Text>
                <View style={s.campusRow}>
                  {CAMPUSES.map(c => (
                    <TouchableOpacity key={c}
                      style={[s.campusChip, campus===c && s.campusChipActive]}
                      onPress={() => setCampus(c)}>
                      <Text style={[s.campusChipTxt, campus===c && s.campusChipTxtActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, loading && s.submitBtnDisabled]}
              onPress={handleAuth} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={s.submitBtnTxt}>
                    {mode === 'login' ? 'Sign In →' : 'Create Account →'}
                  </Text>
              }
            </TouchableOpacity>

            <View style={s.noteBox}>
              <Text style={s.noteTxt}>
                📋 Monitoring against{' '}
                <Text style={{ color:C.blueLight, fontWeight:'600' }}>SANS 241:2015</Text>
                {' '}— South Africa's mandatory drinking water standard
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex:1, backgroundColor:C.bg0 },
  hero:      { backgroundColor:'#0a1628', padding:32, paddingTop:40, alignItems:'center' },
  logoWrap:  { marginBottom:20 },
  logoIcon:  { width:88, height:88, backgroundColor:'rgba(59,130,246,0.2)', borderRadius:26, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(59,130,246,0.4)' },
  appName:   { fontSize:30, fontWeight:'700', color:C.text0, letterSpacing:-0.8, marginBottom:6 },
  tagline:   { fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:20 },
  chipRow:   { flexDirection:'row', gap:8, marginBottom:16 },
  statusChip:{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:20, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  statusDot: { width:5, height:5, borderRadius:3 },
  statusChipTxt:{ fontSize:11, fontWeight:'600', color:'rgba(255,255,255,0.5)' },
  heroDesc:  { fontSize:13, color:'rgba(255,255,255,0.35)', textAlign:'center' },
  form:      { backgroundColor:C.bg1, borderTopLeftRadius:28, borderTopRightRadius:28, padding:28, paddingBottom:40, flex:1, borderTopWidth:1, borderTopColor:C.border },
  modeToggle:{ flexDirection:'row', backgroundColor:C.bg2, borderRadius:12, padding:3, marginBottom:20, borderWidth:1, borderColor:C.border },
  modeBtn:   { flex:1, paddingVertical:9, alignItems:'center', borderRadius:10 },
  modeBtnActive:{ backgroundColor:C.blue },
  modeBtnTxt:{ fontSize:14, fontWeight:'600', color:C.text2 },
  modeBtnTxtActive:{ color:'white' },
  formTitle: { fontSize:20, fontWeight:'700', color:C.text0, marginBottom:20, letterSpacing:-0.4 },
  inputWrap: { marginBottom:14 },
  inputLabel:{ fontSize:12, fontWeight:'600', color:C.text1, marginBottom:6 },
  input:     { backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:14, color:C.text0 },
  passRow:   { flexDirection:'row', backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  showBtn:   { paddingHorizontal:14, justifyContent:'center' },
  showBtnTxt:{ fontSize:12, fontWeight:'600', color:C.blueLight },
  campusRow: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  campusChip:{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:C.bg2, borderWidth:1, borderColor:C.border },
  campusChipActive:{ backgroundColor:'rgba(59,130,246,0.2)', borderColor:'rgba(59,130,246,0.5)' },
  campusChipTxt:{ fontSize:12, fontWeight:'600', color:C.text1 },
  campusChipTxtActive:{ color:C.blueLight },
  submitBtn: { backgroundColor:C.blue, borderRadius:12, padding:16, alignItems:'center', marginTop:8, marginBottom:16 },
  submitBtnDisabled:{ opacity:0.7 },
  submitBtnTxt:{ fontSize:15, fontWeight:'700', color:'white', letterSpacing:-0.3 },
  noteBox:   { backgroundColor:'rgba(59,130,246,0.08)', borderRadius:10, borderWidth:1, borderColor:'rgba(59,130,246,0.2)', padding:12 },
  noteTxt:   { fontSize:12, color:C.text1, lineHeight:18, textAlign:'center' },
});
