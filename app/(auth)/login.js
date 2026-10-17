// app/app/(auth)/login.js
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert, ScrollView, Animated, Easing,
  Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { C, STATUS } from '@/lib/theme';
import AquaLogo from '@/components/AquaLogo';

const { width: SCREEN_W } = Dimensions.get('window');

import { setPendingCampus, getCachedCampus, cacheCampus } from '@/lib/campus';

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

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -150] });
  const translateX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 8, -4] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute', bottom: 20, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(15,160,223,0.18)',
        borderWidth: 1, borderColor: 'rgba(15,160,223,0.3)',
        opacity, transform: [{ translateY }, { translateX }],
      }}
    />
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

// Sign In / Sign Up switch with a "water" thumb: it sloshes across with a
// spring overshoot, stretches while it travels, ripples where it lands and
// has a slow light shimmer moving through it like sun on water.
function LiquidToggle({ mode, onChange }) {
  const PAD = 5;
  const [w, setW] = useState(0);
  const [rippleSide, setRippleSide] = useState(mode === 'login' ? 0 : 1);
  const pos     = useRef(new Animated.Value(mode === 'login' ? 0 : 1)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const ripple  = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const half = w ? (w - PAD * 2) / 2 : 0;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const choose = (m) => {
    if (m === mode) return;
    const to = m === 'login' ? 0 : 1;
    setRippleSide(to);
    ripple.setValue(0);
    onChange(m);
    Animated.parallel([
      Animated.spring(pos, { toValue: to, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(stretch, { toValue: 0, friction: 3, tension: 110, useNativeDriver: true }),
      ]),
      Animated.timing(ripple, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const thumbX  = pos.interpolate({ inputRange: [0, 1], outputRange: [0, half] });
  const scaleX  = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const scaleY  = stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const waveX   = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-half * 0.5, half * 1.2] });
  const rScale  = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.4] });
  const rFade   = ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] });

  return (
    <View style={s.modeToggle} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          {/* ripple, where the water lands */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: PAD + 4, left: PAD + rippleSide * half + half / 2 - 22,
            width: 44, height: 44, borderRadius: 22,
            borderWidth: 2, borderColor: C.blue,
            opacity: rFade, transform: [{ scale: rScale }],
          }} />
          {/* the liquid thumb */}
          <Animated.View pointerEvents="none" style={[s.liquidThumb, {
            width: half, left: PAD,
            transform: [{ translateX: thumbX }, { scaleX }, { scaleY }],
          }]}>
            <Animated.View style={[s.liquidWave, { transform: [{ translateX: waveX }, { rotate: '18deg' }] }]} />
            <Animated.View style={[s.liquidWave2, { transform: [{ translateX: waveX }, { rotate: '18deg' }] }]} />
          </Animated.View>
        </>
      )}
      {['login', 'signup'].map(m => (
        <TouchableOpacity key={m} activeOpacity={1} style={s.modeBtn} onPress={() => choose(m)}>
          <Text style={[s.modeBtnTxt, mode === m && s.modeBtnTxtActive]}>
            {m === 'login' ? 'Sign In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [campus,   setCampus]   = useState('APK');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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
  const formFade    = useRef(new Animated.Value(1)).current;

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

  // Open on this phone's last-used campus (set at sign-up / in Settings)
  useEffect(() => {
    getCachedCampus().then(full => {
      const code = full && full.replace('UJ ', '');
      if (code && CAMPUSES.includes(code)) setCampus(code);
    });
  }, []);

  const switchMode = (m) => {
    Animated.timing(formFade, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => {
        setMode(m);
        Animated.timing(formFade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email above first, then tap "Forgot password?" again.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert('Check your email', 'If an account exists for this email, a password reset link has been sent.');
    } catch (err) {
      Alert.alert('Could not send reset email', err.message);
    }
  };

  const handleAcceptTerms = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users')
          .update({ accepted_terms: true, accepted_terms_at: new Date().toISOString() })
          .eq('id', user.id);
      }
    } catch {
      // best-effort — if there's no active session yet (email confirmation
      // pending), acceptance just won't be recorded server-side immediately
    } finally {
      setShowTerms(false);
      Alert.alert('Account Created', 'Check your email to confirm, then sign in.',
        [{ text:'OK', onPress:() => switchMode('login') }]);
    }
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
        await setPendingCampus(CAMPUS_FULL_NAME[campus]);
        cacheCampus(CAMPUS_FULL_NAME[campus]);
        const { error } = await signUp(email.trim(), password, CAMPUS_FULL_NAME[campus]);
        if (error) throw error;
        setShowTerms(true); // confirmation alert fires after they accept
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
      {/* Light screen: dark status-bar icons (rest of the app has a navy header) */}
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={s.hero}>
            {BUBBLES.map((b, i) => <RisingBubble key={i} {...b} />)}
            <View style={s.glowWrap}>
              <Animated.View style={[s.glow, { opacity: glowFade, transform: [{ scale: glowScale }] }]} />
              <Animated.View style={[s.logoWrap, { transform: [{ translateY: dropletY }, { scale: dropletScale }] }]}>
                <View style={s.logoIcon}><AquaLogo size={84} /></View>
              </Animated.View>
            </View>
            <Text style={s.appName}>AquaSense UJ</Text>
            <Text style={s.tagline}>Campus water quality, live</Text>
          </View>

          {/* Campus + live status — one card, used by both Sign In and Sign Up */}
          <View style={s.campusCard}>
            <Text style={s.cardLabel}>
              {mode === 'signup' ? 'Choose your campus' : 'Water safety at your campus'}
            </Text>
            <View style={s.campusPickRow}>
              {CAMPUSES.map(c => (
                <PressScale key={c} onPress={() => setCampus(c)} style={[s.campusPickChip, campus === c && s.campusPickChipActive]}>
                  <Text style={[s.campusPickTxt, campus === c && s.campusPickTxtActive]}>{c}</Text>
                </PressScale>
              ))}
            </View>
            <View style={s.statusRow}>
              {statusLoading ? (
                <ActivityIndicator size="small" color={C.blue} />
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
            {mode === 'signup' && (
              <Text style={s.cardHint}>Your home screen opens on this campus. You can change it later in Settings.</Text>
            )}
          </View>

          {/* Form */}
          <LiquidToggle mode={mode} onChange={switchMode} />

          <Animated.View style={{ opacity: formFade }}>
            {/* Email */}
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{mode === 'signup' ? 'UJ student email' : 'Email'}</Text>
              <TextInput
                style={s.input}
                placeholder={mode === 'signup' ? '12345678@student.uj.ac.za' : 'student@example.com'}
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
                  style={[s.input, { flex:1, borderWidth:0 }]}
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

              {mode === 'login' && (
                <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                  <Text style={s.forgotTxt}>Forgot password?</Text>
                </TouchableOpacity>
              )}

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
                : <Text style={s.submitBtnTxt}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
              }
            </PressScale>

            {mode === 'signup' && (
              <Text style={s.termsPreNote}>
                By signing up you'll be asked to accept our{' '}
                <Text style={{ color: C.blue, fontWeight: '600' }} onPress={() => router.push('/terms')}>
                  Terms & Conditions
                </Text>.
              </Text>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Post-signup terms acceptance */}
      <Modal visible={showTerms} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={tm.overlay}>
          <View style={tm.sheet}>
            <Text style={tm.title}>📋 Terms & Conditions</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator>
              <Text style={tm.body}>
                AquaSense UJ is an informational academic project, not an official UJ
                facilities or emergency service. Sensor readings may be delayed,
                incomplete, or simulated — for genuine water safety concerns, contact
                UJ Facilities Management directly, not this app.
                {'\n\n'}
                You agree to provide truthful reports and community verification votes,
                and to use the Community section respectfully. If you use the AI
                assistant, your questions are sent to a third-party AI provider (Groq)
                to generate responses.
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={() => router.push('/terms')}>
              <Text style={tm.link}>Read the full Terms & Conditions →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tm.acceptBtn} onPress={handleAcceptTerms}>
              <Text style={tm.acceptTxt}>I Accept & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // One background colour for the whole screen — no dark hero, no sheet
  safe:      { flex:1, backgroundColor:C.bg0 },
  scroll:    { flexGrow:1, paddingHorizontal:24, paddingTop:12, paddingBottom:40 },

  hero:      { alignItems:'center', paddingTop:16, paddingBottom:20, overflow:'hidden', position:'relative' },
  glowWrap:  { width:84, height:84, alignItems:'center', justifyContent:'center', marginBottom:16 },
  glow:      { position:'absolute', width:104, height:104, borderRadius:52, backgroundColor:'rgba(15,160,223,0.22)' },
  logoWrap:  { width:84, height:84, alignItems:'center', justifyContent:'center' },
  logoIcon:  { width:84, height:84, borderRadius:20, overflow:'hidden', shadowColor:C.navy, shadowOpacity:0.2, shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:5 },
  appName:   { fontSize:28, fontWeight:'800', color:C.navy, letterSpacing:-0.6, marginBottom:4 },
  tagline:   { fontSize:13, color:C.text2 },

  campusCard:{ backgroundColor:C.bg2, borderRadius:18, borderWidth:1, borderColor:C.border, padding:16, marginBottom:20, alignItems:'center' },
  cardLabel: { fontSize:11, fontWeight:'700', color:C.text2, textTransform:'uppercase', letterSpacing:0.6, marginBottom:12 },
  cardHint:  { fontSize:11, color:C.text2, textAlign:'center', marginTop:12, lineHeight:16 },
  campusPickRow: { flexDirection:'row', gap:8, marginBottom:14 },
  campusPickChip:{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border },
  campusPickChipActive:{ backgroundColor:'rgba(15,160,223,0.15)', borderColor:C.blue },
  campusPickTxt: { fontSize:12, fontWeight:'700', color:C.text2 },
  campusPickTxtActive:{ color:C.blue },

  statusRow:   { height:32, justifyContent:'center' },
  statusBadge: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.bg0, borderRadius:20, paddingHorizontal:16, paddingVertical:7, borderWidth:1, borderColor:C.border },
  dotWrap:     { width:10, height:10, alignItems:'center', justifyContent:'center' },
  dot:         { width:8, height:8, borderRadius:4, position:'absolute' },
  pulseRing:   { width:8, height:8, borderRadius:4, borderWidth:1, position:'absolute' },
  statusTxt:   { fontSize:13, fontWeight:'700' },

  modeToggle:{ flexDirection:'row', backgroundColor:C.bg3, borderRadius:16, padding:5, marginBottom:22, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  modeBtn:   { flex:1, minHeight:46, alignItems:'center', justifyContent:'center' },
  modeBtnTxt:{ fontSize:15, fontWeight:'700', color:C.text2 },
  modeBtnTxtActive:{ color:'white' },
  liquidThumb:{ position:'absolute', top:5, bottom:5, borderRadius:12, backgroundColor:C.blue, overflow:'hidden', shadowColor:C.blue, shadowOpacity:0.35, shadowRadius:8, shadowOffset:{width:0,height:3}, elevation:3 },
  liquidWave: { position:'absolute', top:-20, bottom:-20, width:26, backgroundColor:'rgba(255,255,255,0.16)' },
  liquidWave2:{ position:'absolute', top:-20, bottom:-20, left:34, width:10, backgroundColor:'rgba(255,255,255,0.10)' },

  inputWrap: { marginBottom:16 },
  inputLabel:{ fontSize:12, fontWeight:'600', color:C.text1, marginBottom:6 },
  input:     { backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, padding:14, fontSize:14, color:C.text0 },
  hint:      { fontSize:11, marginTop:6, fontWeight:'500' },
  passRow:   { flexDirection:'row', alignItems:'center', backgroundColor:C.bg2, borderRadius:12, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  showBtn:   { paddingHorizontal:14, justifyContent:'center' },
  showBtnTxt:{ fontSize:12, fontWeight:'600', color:C.blue },
  forgotTxt: { fontSize:12, fontWeight:'600', color:C.blue },

  strengthWrap:  { marginTop:12 },
  strengthTrack: { height:6, backgroundColor:C.bg3, borderRadius:3, overflow:'hidden', marginBottom:8 },
  strengthFill:  { height:6, borderRadius:3 },
  reqGrid:       { flexDirection:'row', flexWrap:'wrap', gap:6 },
  reqTxt:        { fontSize:11, fontWeight:'600', width:'47%' },

  submitBtn: { backgroundColor:C.blue, borderRadius:14, padding:16, alignItems:'center', marginTop:4, marginBottom:14, shadowColor:C.blue, shadowOpacity:0.3, shadowRadius:10, shadowOffset:{width:0,height:4}, elevation:4 },
  submitBtnDisabled:{ opacity:0.7 },
  submitBtnTxt:{ fontSize:16, fontWeight:'700', color:'white', letterSpacing:-0.2 },
  termsPreNote:{ fontSize:11, color:C.text2, textAlign:'center', lineHeight:16 },
});

const tm = StyleSheet.create({
  overlay:   { flex:1, backgroundColor:'rgba(13,47,95,0.6)', justifyContent:'flex-end' },
  sheet:     { backgroundColor:C.bg1, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:36 },
  title:     { fontSize:18, fontWeight:'700', color:C.text0, marginBottom:12 },
  body:      { fontSize:13, color:C.text1, lineHeight:20 },
  link:      { fontSize:12, fontWeight:'600', color:C.blue, textAlign:'center', marginTop:14, marginBottom:16 },
  acceptBtn: { backgroundColor:C.blue, borderRadius:12, paddingVertical:15, alignItems:'center' },
  acceptTxt: { fontSize:14, fontWeight:'700', color:'white' },
});
