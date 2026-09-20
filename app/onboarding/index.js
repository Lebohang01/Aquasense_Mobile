// app/app/onboarding/index.js
import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '💧',
    title: 'Welcome to AquaSense UJ',
    body: 'Real-time water quality monitoring across all UJ campuses, checked against South Africa\'s SANS 241:2015 drinking water standard.',
  },
  {
    emoji: '✅',
    title: 'Know what SAFE, CAUTION, and UNSAFE mean',
    body: 'Every reading is checked against pH, TDS, turbidity, and temperature limits. A CAUTION badge means a parameter is approaching its limit — UNSAFE means it has been exceeded.',
  },
  {
    emoji: '🗺️',
    title: 'Map, AI assistant, and alerts',
    body: 'See every water point on the map, ask AquaAI anything about current water quality, and get push notifications the moment a node goes UNSAFE.',
  },
  {
    emoji: '⭐',
    title: 'Earn points as a Water Guardian',
    body: 'Check in at fountains, help verify readings, and build a streak. Compete on the leaderboard and track your sustainability impact.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ has_seen_onboarding: true }).eq('id', user.id);
    }
    router.replace('/(tabs)');
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
      setIndex(index + 1);
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.skipBtn} onPress={finish}>
        <Text style={s.skipTxt}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[s.slide, { width }]}>
            <Text style={s.emoji}>{slide.emoji}</Text>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={s.nextBtn} onPress={goNext}>
        <Text style={s.nextBtnTxt}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg0 },
  skipBtn:  { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, margin: 16, borderRadius: 8, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  skipTxt:  { fontSize: 13, color: C.text2, fontWeight: '700' },
  slide:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji:    { fontSize: 56, marginBottom: 24 },
  title:    { fontSize: 20, fontWeight: '700', color: C.text0, textAlign: 'center', marginBottom: 12 },
  body:     { fontSize: 14, color: C.text1, textAlign: 'center', lineHeight: 21 },
  dots:     { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotActive:{ backgroundColor: C.blue, width: 20 },
  nextBtn:  { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginHorizontal: 24, marginBottom: 24 },
  nextBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
