// app/components/LockScreen.js
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { authenticateWithBiometrics } from '@/lib/biometricAuth';
import AquaLogo from '@/components/AquaLogo';
import { C } from '@/lib/theme';

export default function LockScreen({ onUnlock }) {
  const tryUnlock = async () => {
    const success = await authenticateWithBiometrics();
    if (success) onUnlock();
  };

  return (
    <View style={s.wrap}>
      <View style={s.logoShadow}><AquaLogo size={104} /></View>
      <Text style={s.title}>AquaSense UJ</Text>
      <Text style={s.subtitle}>Locked for your security</Text>
      <TouchableOpacity style={s.unlockBtn} onPress={tryUnlock}>
        <Text style={s.unlockTxt}>🔓 Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center', gap: 6, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  logoShadow: { borderRadius: 26, overflow: 'hidden', marginBottom: 14, shadowColor: C.navy, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  title:      { fontSize: 20, fontWeight: '800', color: C.navy, letterSpacing: -0.3 },
  subtitle:   { fontSize: 13, color: C.text1, marginBottom: 24 },
  unlockBtn:  { backgroundColor: C.blue, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  unlockTxt:  { fontSize: 15, fontWeight: '700', color: '#fff' },
});
