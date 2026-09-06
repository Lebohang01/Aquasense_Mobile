// app/app/upgrade/index.js
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSubscriptionStatus, mockSubscribeToPremium, mockCancelPremium, FREE_TIER_DAILY_AI_LIMIT } from '@/lib/subscription';

const C = {
  bg0: '#0a0e1a', bg1: '#0f1525', bg2: '#151c30', bg3: '#1c2540',
  blue: '#3b82f6', blueLight: '#60a5fa', purple: '#a78bfa',
  green: '#22c55e', amber: '#f59e0b',
  text0: '#f1f5f9', text1: '#94a3b8', text2: '#475569', border: '#1e2d47',
};

const PREMIUM_FEATURES = [
  { icon: '💬', title: 'Unlimited AI chat', desc: `Free tier is capped at ${FREE_TIER_DAILY_AI_LIMIT} messages/day` },
  { icon: '📈', title: '7-day predictive insights', desc: 'Anomaly trend narratives for every node, not just flagged ones' },
  { icon: '📥', title: 'Export historical data', desc: 'Download readings as CSV for your own analysis' },
  { icon: '🔔', title: 'Custom alert rules', desc: 'Choose exactly which nodes and parameters notify you' },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const s = await getSubscriptionStatus();
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubscribe = async () => {
    setBusy(true);
    const result = await mockSubscribeToPremium();
    setBusy(false);
    if (result.success) {
      Alert.alert('Welcome to Premium 🎉', 'This is a demo purchase — no real payment was processed.');
      load();
    } else {
      Alert.alert('Could not upgrade', result.error || 'Unknown error');
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Premium?', 'This is a demo — you can re-subscribe anytime.', [
      { text: 'Keep Premium', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive', onPress: async () => {
          setBusy(true);
          await mockCancelPremium();
          setBusy(false);
          load();
        },
      },
    ]);
  };

  if (loading || !status) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ color: C.text1, textAlign: 'center', marginTop: 40 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Text style={{ color: C.text1, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>

        <View style={s.demoBanner}>
          <Text style={s.demoBannerTxt}>
            🎭 Demo mode — this simulates a purchase. No real payment is processed anywhere.
          </Text>
        </View>

        <Text style={s.hero}>💧✨</Text>
        <Text style={s.title}>AquaSense Premium</Text>
        <Text style={s.subtitle}>
          {status.isPremium
            ? "You're on Premium — thanks for supporting AquaSense."
            : 'Unlock unlimited AI insights and deeper water quality analytics.'}
        </Text>

        {!status.isPremium && (
          <View style={s.usageCard}>
            <Text style={s.usageTxt}>
              You've used {status.messagesUsedToday} of {status.dailyLimit} free AI messages today
            </Text>
            <View style={s.usageBarTrack}>
              <View style={[s.usageBarFill, { width: `${Math.min(100, (status.messagesUsedToday / status.dailyLimit) * 100)}%` }]} />
            </View>
          </View>
        )}

        <View style={{ gap: 12, marginTop: 20 }}>
          {PREMIUM_FEATURES.map(f => (
            <View key={f.title} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 28 }}>
          {status.isPremium ? (
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancel} disabled={busy}>
              <Text style={s.cancelBtnTxt}>{busy ? 'Working...' : 'Cancel Premium'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={s.subscribeBtn} onPress={handleSubscribe} disabled={busy}>
                <Text style={s.subscribeBtnTxt}>{busy ? 'Processing...' : 'Upgrade to Premium (Demo)'}</Text>
              </TouchableOpacity>
              <Text style={s.priceNote}>Simulated price: R29/month — no card required for this demo</Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg0 },
  demoBanner:{ backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 10, padding: 10, marginBottom: 20 },
  demoBannerTxt: { fontSize: 11, color: C.amber, textAlign: 'center' },
  hero:      { fontSize: 40, textAlign: 'center' },
  title:     { fontSize: 22, fontWeight: '700', color: C.text0, textAlign: 'center', marginTop: 8 },
  subtitle:  { fontSize: 13, color: C.text1, textAlign: 'center', marginTop: 6, paddingHorizontal: 10 },
  usageCard: { backgroundColor: C.bg2, borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: C.border },
  usageTxt:  { fontSize: 12, color: C.text1, marginBottom: 8 },
  usageBarTrack: { height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: 'hidden' },
  usageBarFill:  { height: 6, backgroundColor: C.amber, borderRadius: 3 },
  featureRow:  { flexDirection: 'row', gap: 12, backgroundColor: C.bg2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  featureIcon: { fontSize: 22 },
  featureTitle:{ fontSize: 14, fontWeight: '700', color: C.text0 },
  featureDesc: { fontSize: 12, color: C.text1, marginTop: 2 },
  subscribeBtn:{ backgroundColor: C.purple, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  subscribeBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  priceNote: { fontSize: 11, color: C.text2, textAlign: 'center', marginTop: 10 },
  cancelBtn: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnTxt: { fontSize: 15, fontWeight: '700', color: C.text1 },
});
