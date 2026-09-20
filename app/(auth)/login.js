// app/app/(auth)/login.js
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView, Animated, Easing,
  LayoutAnimation, UIManager, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { C, STATUS } from '@/lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');

const CAMPUSES = ['APK', 'APB', 'DFC', 'SWC'];
const CAMPUS_FULL_NAME = { APK: 'UJ APK', APB: 'UJ APB', DFC: 'UJ DFC', SWC: 'UJ SWC' };

// Real UJ student email convention: studentnumber@student.uj.ac.za
const UJ_EMAIL_RE = /^\d{6,9}@student\.uj\.ac\.za$/i;

function validatePassword(pw) {
  const checks = {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { ...checks, score, isValid: score === 5 };
}

const STATUS_META = {
  SAFE:    { color: STATUS.SAFE.color,    emoji: '✅', label: 'Safe' },
  CAUTION: { color: STATUS.CAUTION.color, emoji: '⚠️', label: 'Caution' },
  UNSAFE:  { color: STATUS.UNSAFE.color,  emoji: '🚨', label: 'Unsafe' },
  UNKNOWN: { color: C.text2,              emoji: '·',  label: 'No data yet' },
};

const BUBBLES = [
  { size: 8,  left: '10%', duration: 5200, delay: 0    },
  { size: 5,  left: '22%', duration: 4200, delay: 900  },
  { size: 10, left: '38%', duration: 6000, delay: 300  },
  { size: 6,  left: '58%', duration: 4800, delay: 1500 },
  { size: 7,  left: '74%', duration: 5500, delay: 600  },
  { size: 5,  left: '88%', duration: 4400, delay: 1200 },
];

function RisingBubble({ size, left, duration, delay }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -200] });
  const translateX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 8, -4] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.35, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute', bottom: 20, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
        opacity, transform: [{ translateY }, { translateX }],
      }}
    />
  );
}

function WaveLayer({ amplitude, phaseOffset, opacity, color, duration }) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [-14 + phaseOffset, 14 + phaseOffset] });
  const w = SCREEN_W;

  return (
    <Animated.View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateX }] }}>
      <Svg width={w} height={28} viewBox={`0 0 ${w} 28`}>
        <Path
          d={`M0,14 Q${w * 0.25},${14 - amplitude} ${w * 0.5},14 T${w},14 V28 H0 Z`}
          fill={color}
          opacity={opacity}
        />
      </Svg>
    </Animated.View>
  );
}

function PressScale({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, friction: 5 }).start();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [campus,   setCampus]   = useState('APK');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const [campusStatus,  setCampusStatus]  = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const passCheck = validatePassword(password);

  // ---------- Animations ----------
  const dropletY     = useRef(new Animated.Value(0)).current;
  const dropletScale = useRef(new Animated.Value(1)).current;
  const glowScale     = useRef(new Animated.Value(1)).current;
  const glowFade      = useRef(new Animated.Value(0.5)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Fade  = useRef(new Animated.Value(1)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Fade  = useRef(new Animated.Value(1)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const statusFade  = useRef(new Animated.Value(0)).current;
  const statusScale = useRef(new Animated.Value(0.9)).current;

  // Floaty droplet — bob + gentle squash/stretch, like it's bobbing on water
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dropletY,     { toValue: -10, duration: 1100, easing: Easing.out(Easing.sin), useNativeDriver: true }),
          Animated.timing(dropletScale, { toValue: 1.06, duration: 1100, easing: Easing.out(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(dropletY,     { toValue: 0, duration: 1100, easing: Easing.in(Easing.sin), useNativeDriver: true }),
          Animated.timing(dropletScale, { toValue: 0.96, duration: 1100, easing: Easing.in(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.timing(dropletScale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Soft glow pulsing behind the droplet
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.25, duration: 1300, useNativeDriver: true }),
          Animated.timing(glowFade,  { toValue: 0.15, duration: 1300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1, duration: 1300, useNativeDriver: true }),
          Animated.timing(glowFade,  { toValue: 0.5, duration: 1300, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Double sonar rings around the status dot, staggered for a livelier pulse
  useEffect(() => {
    const makeRing = (scaleV, fadeV, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scaleV, { toValue: 2.2, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(fadeV,  { toValue: 0,   duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.timing(scaleV, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(fadeV,  { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    const l1 = makeRing(ring1Scale, ring1Fade, 0);
    const l2 = makeRing(ring2Scale, ring2Fade, 700);
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, []);

  // Password strength bar fills like a rising water level
  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: passCheck.score / 5,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating width, not a transform
    }).start();
  }, [password]);

  const fetchCampusStatus = useCallback(async (code) => {
    setStatusLoading(true);
    statusFade.setValue(0);
    statusScale.setValue(0.9);
    try {
      const { data } = await supabase
        .from('public_campus_status')
        .select('status')
        .eq('campus', CAMPUS_FULL_NAME[code])
        .maybeSingle();
      setCampusStatus(data?.status || 'UNKNOWN');
    } catch {
      setCampusStatus('UNKNOWN');
    } finally {
      setStatusLoading(false);
      Animated.parallel([
        Animated.timing(statusFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(statusScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => { fetchCampusStatus(campus); }, [campus, fetchCampusStatus]);

  const switchMode = (m) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(m);
  };

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!UJ_EMAIL_RE.test(email.trim())) {
        Alert.alert(
          'Invalid email',
          'Please sign up with your UJ student email, in the format studentnumber@student.uj.ac.za'
        );
        return;
      }
      if (!passCheck.isValid) {
        Alert.alert(
          'Password too weak',
          'Your password must have at least 8 characters, an uppercase letter, a lowercase letter, a number, and a special character.'
        );
        return;
      }
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
          [{ text:'OK', onPress:() => switchMode('login') }]);
      }
    } catch (err) {
      Alert.alert(mode === 'login' ? 'Login Failed' : 'Sign Up Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = passCheck.score <= 2 ? C.red : passCheck.score <= 4 ? C.amber : C.green;
  const sm = STATUS_META[campusStatus] || STATUS_META.UNKNOWN;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow:1 }} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={s.hero}>
            {BUBBLES.map((b, i) => <RisingBubble key={i} {...b} />)}

            <View style={s.glowWrap}>
              <Animated.View style={[s.glow, { opacity: glowFade, transform: [{ scale: glowScale }] }]} />
              <Animated.View style={[s.logoWrap, { transform: [{ translateY: dropletY }, { scale: dropletScale }] }]}>
                <View style={s.logoIcon}><Text style={{ fontSize:44 }}>💧</Text></View>
              </Animated.View>
            </View>

            <Text style={s.appName}>AquaSense UJ</Text>
            <Text style={s.tagline}>SANS 241:2015 Water Quality Monitor</Text>

            {/* Safety check — replaces the old static pH/TDS/Turbidity/Temp chips */}
            <Text style={s.safetyLabel}>Check water safety at your campus</Text>
            <View style={s.campusPickRow}>
              {CAMPUSES.map(c => (
                <PressScale key={c} onPress={() => setCampus(c)} style={[s.campusPickChip, campus === c && s.campusPickChipActive]}>
                  <Text style={[s.campusPickTxt, campus === c && s.campusPickTxtActive]}>{c}</Text>
                </PressScale>
              ))}
            </View>

            <View style={s.statusRow}>
              {statusLoading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              ) : (
                <Animated.View style={[s.statusBadge, { opacity: statusFade, transform: [{ scale: statusScale }] }]}>
                  <View style={s.dotWrap}>
                    <Animated.View style={[s.pulseRing, { borderColor: sm.color, opacity: ring1Fade, transform: [{ scale: ring1Scale }] }]} />
                    <Animated.View style={[s.pulseRing, { borderColor: sm.color, opacity: ring2Fade, transform: [{ scale: ring2Scale }] }]} />
                    <View style={[s.dot, { backgroundColor: sm.color }]} />
                  </View>
                  <Text style={[s.statusTxt, { color: sm.color }]}>{sm.emoji} {sm.label}</Text>
                </Animated.View>
              )}
            </View>

            <Text style={s.heroDesc}>Real-time drinking water monitoring across UJ campuses</Text>

            {/* Gently swaying water-surface line where the hero meets the form */}
            <WaveLayer amplitude={5}  phaseOffset={0}  opacity={0.10} color="#ffffff" duration={3200} />
            <WaveLayer amplitude={7}  phaseOffset={10} opacity={0.06} color="#ffffff" duration={4000} />
          </View>

          {/* Form */}
          <View style={s.form}>
            {/* Mode toggle */}
            <View style={s.modeToggle}>
              {['login','signup'].map(m => (
                <PressScale key={m} onPress={() => switchMode(m)} style={[s.modeBtn, mode===m && s.modeBtnActive]}>
                  <Text style={[s.modeBtnTxt, mode===m && s.modeBtnTxtActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </PressScale>
              ))}
            </View>

            <Text style={s.formTitle}>
              {mode === 'login' ? 'Welcome back' : 'Join AquaSense UJ'}
            </Text>

            {/* Email */}
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{mode === 'signup' ? 'UJ Student Email' : 'Email'}</Text>
              <TextInput
                style={s.input}
                placeholder={mode === 'signup' ? 'e.g. 12345678@student.uj.ac.za' : 'student@example.com'}
                placeholderTextColor={C.text2}
                value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
              />
              {mode === 'signup' && email.length > 0 && (
                <Text style={[s.hint, { color: UJ_EMAIL_RE.test(email.trim()) ? C.green : C.text2 }]}>
                  {UJ_EMAIL_RE.test(email.trim()) ? '✓ Valid UJ student email' : 'Format: studentnumber@student.uj.ac.za'}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Password</Text>
              <View style={s.passRow}>
                <TextInput
                  style={[s.input, { flex:1, marginBottom:0, borderWidth:0 }]}
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

              {/* Water-level password strength meter (signup only) */}
              {mode === 'signup' && password.length > 0 && (
                <View style={s.strengthWrap}>
                  <View style={s.strengthTrack}>
                    <Animated.View style={[s.strengthFill, {
                      backgroundColor: strengthColor,
                      width: strengthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    }]} />
                  </View>
                  <View style={s.reqGrid}>
                    {[
                      ['8+ characters', passCheck.length],
                      ['Uppercase',     passCheck.upper],
                      ['Lowercase',     passCheck.lower],
                      ['Number',        passCheck.number],
                      ['Special char',  passCheck.special],
                    ].map(([label, met]) => (
                      <Text key={label} style={[s.reqTxt, { color: met ? C.green : C.text2 }]}>
                        {met ? '✓' : '○'} {label}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <PressScale onPress={handleAuth} disabled={loading} style={[s.submitBtn, loading && s.submitBtnDisabled]}>
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={s.submitBtnTxt}>
                    {mode === 'login' ? 'Sign In →' : 'Create Account →'}
                  </Text>
              }
            </PressScale>

            <View style={s.noteBox}>
              <Text style={s.noteTxt}>
                📋 Monitoring against{' '}
                <Text style={{ color:C.blue, fontWeight:'600' }}>SANS 241:2015</Text>
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
  hero:      { backgroundColor:C.navy, padding:32, paddingTop:40, alignItems:'center', overflow:'hidden', position:'relative' },

  glowWrap:  { width:88, height:88, alignItems:'center', justifyContent:'center', marginBottom:20 },
  glow:      { position:'absolute', width:100, height:100, borderRadius:50, backgroundColor:'rgba(94,195,239,0.5)' },
  logoWrap:  { width:88, height:88, alignItems:'center', justifyContent:'center' },
  logoIcon:  { width:88, height:88, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:26, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  appName:   { fontSize:30, fontWeight:'700', color:'#ffffff', letterSpacing:-0.8, marginBottom:6 },
  tagline:   { fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:22 },

  safetyLabel: { fontSize:11, fontWeight:'700', color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:0.6, marginBottom:10 },
  campusPickRow: { flexDirection:'row', gap:8, marginBottom:14 },
  campusPickChip:{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  campusPickChipActive:{ backgroundColor:'rgba(15,160,223,0.35)', borderColor:'rgba(94,195,239,0.7)' },
  campusPickTxt: { fontSize:12, fontWeight:'700', color:'rgba(255,255,255,0.6)' },
  campusPickTxtActive:{ color:'#ffffff' },

  statusRow:   { height:30, justifyContent:'center', marginBottom:12 },
  statusBadge: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:20, paddingHorizontal:14, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  dotWrap:     { width:10, height:10, alignItems:'center', justifyContent:'center' },
  dot:         { width:8, height:8, borderRadius:4, position:'absolute' },
  pulseRing:   { width:8, height:8, borderRadius:4, borderWidth:1, position:'absolute' },
  statusTxt:   { fontSize:12, fontWeight:'700' },

  heroDesc:  { fontSize:13, color:'rgba(255,255,255,0.5)', textAlign:'center', marginBottom:8 },

  form:      { backgroundColor:C.bg1, borderTopLeftRadius:28, borderTopRightRadius:28, padding:28, paddingBottom:40, flex:1, borderTopWidth:1, borderTopColor:C.border },
  modeToggle:{ flexDirection:'row', backgroundColor:C.bg3, borderRadius:12, padding:3, marginBottom:20, borderWidth:1, borderColor:C.border },
  modeBtn:   { flex:1, paddingVertical:9, alignItems:'center', borderRadius:10 },
  modeBtnActive:{ backgroundColor:C.blue },
  modeBtnTxt:{ fontSize:14, fontWeight:'600', color:C.text2 },
  modeBtnTxtActive:{ color:'white' },
  formTitle: { fontSize:20, fontWeight:'700', color:C.text0, marginBottom:20, letterSpacing:-0.4 },
  inputWrap: { marginBottom:14 },
  inputLabel:{ fontSize:12, fontWeight:'600', color:C.text1, marginBottom:6 },
  input:     { backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:14, color:C.text0 },
  hint:      { fontSize:11, marginTop:6, fontWeight:'500' },
  passRow:   { flexDirection:'row', alignItems:'center', backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  showBtn:   { paddingHorizontal:14, justifyContent:'center' },
  showBtnTxt:{ fontSize:12, fontWeight:'600', color:C.blue },

  strengthWrap:  { marginTop:10 },
  strengthTrack: { height:6, backgroundColor:C.bg3, borderRadius:3, overflow:'hidden', marginBottom:8 },
  strengthFill:  { height:6, borderRadius:3 },
  reqGrid:       { flexDirection:'row', flexWrap:'wrap', gap:8 },
  reqTxt:        { fontSize:11, fontWeight:'600', width:'47%' },

  submitBtn: { backgroundColor:C.blue, borderRadius:12, padding:16, alignItems:'center', marginTop:8, marginBottom:16 },
  submitBtnDisabled:{ opacity:0.7 },
  submitBtnTxt:{ fontSize:15, fontWeight:'700', color:'white', letterSpacing:-0.3 },
  noteBox:   { backgroundColor:'rgba(15,160,223,0.06)', borderRadius:10, borderWidth:1, borderColor:'rgba(15,160,223,0.2)', padding:12 },
  noteTxt:   { fontSize:12, color:C.text1, lineHeight:18, textAlign:'center' },
});
