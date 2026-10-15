// app/components/LoadingScreen.js
// In-app loading screen shown while the session is being restored.
// Matches the native splash (same logo, same light background) so the
// hand-off from splash to app looks seamless.
import { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import AquaLogo from '@/components/AquaLogo';
import { C } from '@/lib/theme';

export default function LoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={s.wrap}>
      <Animated.View style={[s.logo, { opacity, transform: [{ scale }] }]}>
        <AquaLogo size={112} />
      </Animated.View>
      <Text style={s.title}>AquaSense UJ</Text>
      <Text style={s.sub}>Checking campus water quality…</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center', gap: 6 },
  logo:  { borderRadius: 28, overflow: 'hidden', marginBottom: 14, shadowColor: C.navy, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  title: { fontSize: 20, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
  sub:   { fontSize: 13, color: C.text1 },
});
