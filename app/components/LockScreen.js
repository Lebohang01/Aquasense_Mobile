// app/components/LockScreen.js
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { authenticateWithBiometrics } from '@/lib/biometricAuth';

const C = {
  bg0: '#0a0e1a', blue: '#3b82f6',
  text0: '#f1f5f9', text1: '#94a3b8',
};

export default function LockScreen({ onUnlock }) {
  const tryUnlock = async () => {
    const success = await authenticateWithBiometrics();
    if (success) onUnlock();
  };

  return (
    <View style={s.wrap}>
      <Text style={s.emoji}>💧</Text>
      <Text style={s.title}>AquaSense UJ</Text>
      <Text style={s.subtitle}>Locked for your security</Text>
      <TouchableOpacity style={s.unlockBtn} onPress={tryUnlock}>
        <Text style={s.unlockTxt}>🔓 Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flex: 1, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center', gap: 6, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
  emoji:     { fontSize: 48, marginBottom: 8 },
  title:     { fontSize: 18, fontWeight: '700', color: C.text0 },
  subtitle:  { fontSize: 13, color: C.text1, marginBottom: 24 },
  unlockBtn: { backgroundColor: C.blue, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  unlockTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
