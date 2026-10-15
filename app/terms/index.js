// app/app/terms/index.js
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { C } from '@/lib/theme';

const SECTIONS = [
  {
    title: '1. What AquaSense UJ Is',
    body: 'AquaSense UJ is a water quality monitoring tool for the University of Johannesburg, built by students as an academic project. It displays readings from IoT sensors and/or test data at campus water points, checked against the SANS 241:2015 South African drinking water standard.',
  },
  {
    title: '2. Not an Official Health Service',
    body: 'AquaSense UJ is informational only. It is not an official UJ facilities system, not a substitute for official municipal or university water safety communications, and not a medical or emergency service. If you have a genuine health concern about water quality, contact UJ Facilities Management or relevant health authorities directly — do not rely solely on this app.',
  },
  {
    title: '3. Data Accuracy',
    body: 'Readings may be delayed, incomplete, affected by sensor malfunction, or (during development/testing) simulated rather than live. We make reasonable efforts to keep data accurate but do not guarantee it. SAFE/CAUTION/UNSAFE statuses reflect the last received reading only, which may not reflect current real-time conditions.',
  },
  {
    title: '4. Your Account',
    body: 'Sign-up is intended for UJ students using a valid UJ student email. You are responsible for keeping your login credentials secure and for all activity under your account. You must be truthful when submitting water quality reports or community verification votes — submitting false reports may result in account suspension.',
  },
  {
    title: '5. What We Collect',
    body: 'We store your email, campus preference, and app usage data needed to run core features: check-ins, community verification votes, points/streaks, and (if enabled) a push notification token for alerts. If you use the AI assistant, your questions and relevant live sensor data are sent to Groq, a third-party AI provider, to generate a response — do not include sensitive personal information in AI chat messages.',
  },
  {
    title: '6. Community Features',
    body: 'Posts, comments, and direct messages in the Community section are visible to other users as described in-app. Be respectful — harassment, spam, or abuse of other users may result in account suspension. Do not share sensitive personal information in public posts.',
  },
  {
    title: '7. Changes to These Terms',
    body: 'These terms may be updated as the app develops. Continued use of the app after an update constitutes acceptance of the revised terms.',
  },
  {
    title: '8. Contact',
    body: 'Questions about these terms or the app can be directed to the development team through the university project channel this app was submitted under.',
  },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <Text style={s.updated}>Last updated: 2026</Text>
        {SECTIONS.map(sec => (
          <View key={sec.title} style={{ marginBottom: 20 }}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg0 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bg1, borderBottomWidth: 1, borderBottomColor: C.border },
  back:       { fontSize: 14, fontWeight: '600', color: C.blue, width: 50 },
  headerTitle:{ fontSize: 16, fontWeight: '700', color: C.text0 },
  updated:    { fontSize: 11, color: C.text2, marginBottom: 20 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: C.text0, marginBottom: 6 },
  sectionBody:{ fontSize: 13, color: C.text1, lineHeight: 20 },
});
