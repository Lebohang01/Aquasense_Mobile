// app/app/ai-assistant/index.js
// AI Water Quality Assistant — Mobile Screen
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const C = {
  bg0:'#0a0e1a', bg1:'#0f1525', bg2:'#151c30', bg3:'#1c2540',
  blue:'#3b82f6', blueLight:'#60a5fa',
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  text0:'#f1f5f9', text1:'#94a3b8', text2:'#475569',
  border:'#1e2d47',
};

const SUGGESTIONS = [
  'Is APK water safe to drink right now?',
  'What campus has the best water quality?',
  'Explain the current alerts to me',
  'What does TDS mean for drinking water?',
  'What is SANS 241:2015?',
];

async function getLiveData() {
  const [
    { data: nodes },
    { data: readings },
    { data: alerts },
  ] = await Promise.all([
    supabase.from('nodes').select('*').order('campus'),
    supabase.from('readings').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('alerts').select('*, nodes(location_name, campus)').is('resolved_at', null).limit(20),
  ]);

  const latestPerNode = {};
  (readings || []).forEach(r => {
    if (!latestPerNode[r.node_id]) latestPerNode[r.node_id] = r;
  });

  return {
    nodes: (nodes || []).map(n => ({
      name: n.location_name,
      campus: n.campus,
      status: n.status,
      reading: latestPerNode[n.node_id] ? {
        ph: latestPerNode[n.node_id].ph,
        tds: latestPerNode[n.node_id].tds,
        turbidity: latestPerNode[n.node_id].turbidity,
        temperature: latestPerNode[n.node_id].temperature,
        sans_status: latestPerNode[n.node_id].sans_status,
      } : null,
    })),
    activeAlerts: (alerts || []).map(a => ({
      parameter: a.parameter,
      value: a.value,
      threshold: a.threshold,
      status: a.sans_status,
      location: a.nodes?.location_name,
      campus: a.nodes?.campus,
    })),
  };
}

function TypingDots() {
  return (
    <View style={td.wrap}>
      <View style={td.av}><Text style={{ fontSize: 14 }}>💧</Text></View>
      <View style={td.bubble}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[td.dot, { opacity: 0.4 + i * 0.2 }]} />
        ))}
      </View>
    </View>
  );
}

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[mb.row, isUser && mb.rowUser]}>
      {!isUser && <View style={mb.av}><Text style={{ fontSize: 14 }}>💧</Text></View>}
      <View style={[mb.bubble, isUser ? mb.bubbleUser : mb.bubbleAI]}>
        <Text style={[mb.txt, isUser && mb.txtUser]}>{msg.content}</Text>
      </View>
    </View>
  );
}

export default function AIAssistantScreen() {
  const router = useRouter();
  const listRef = useRef(null);
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hi! I'm AquaAI 💧\n\nI have live access to water quality readings across all UJ campuses. Ask me anything — whether the water is safe, what the readings mean, or which campus has the best quality right now.",
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const send = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setShowSuggestions(false);

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Get live Supabase data
      const liveData = await getLiveData();

      const systemPrompt = `You are AquaAI, the intelligent water quality assistant for the University of Johannesburg AquaSense monitoring system.

## SANS 241:2015 Standards
- pH: 5.0–9.7 (UNSAFE: below 4.0 or above 11.0)
- TDS: ≤ 1200 mg/L (UNSAFE: above 2400)
- Turbidity: ≤ 5 NTU (UNSAFE: above 10)
- Temperature: 5–25°C

## UJ Campuses
- UJ APK: Auckland Park Kingsway
- UJ APB: Auckland Park Bunting Road
- UJ DFC: Doornfontein Campus
- UJ SWC: Soweto Campus

## LIVE DATA RIGHT NOW:
${JSON.stringify(liveData, null, 2)}

Keep responses concise (2-3 paragraphs max). Use plain English. If water is UNSAFE, warn clearly.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 600,
          messages: [
            { role: 'system', content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not connect right now. Please check your internet connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerIcon}><Text style={{ fontSize: 18 }}>💧</Text></View>
          <View>
            <Text style={s.headerTitle}>AquaAI Assistant</Text>
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>Live data · SANS 241:2015</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => { setMessages([{ role:'assistant', content:"Hi! I'm AquaAI 💧 How can I help you with water quality today?" }]); setShowSuggestions(true); }}>
          <Text style={{ fontSize: 16, color: C.text2 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={[...messages, ...(loading ? [{ role: 'typing', content: '' }] : [])]}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            if (item.role === 'typing') return <TypingDots />;
            return <MsgBubble msg={item} />;
          }}
          ListFooterComponent={
            showSuggestions && messages.length === 1 ? (
              <View style={s.suggestions}>
                <Text style={s.suggestionsLabel}>Quick questions</Text>
                {SUGGESTIONS.map(q => (
                  <TouchableOpacity key={q} style={s.suggestionBtn} onPress={() => send(q)}>
                    <Text style={s.suggestionTxt}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
        />

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about water quality..."
            placeholderTextColor={C.text2}
            multiline
            maxLength={500}
            editable={!loading}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnOff]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color="white" />
              : <Text style={s.sendBtnTxt}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.bg0 },
  header:      { backgroundColor: C.bg1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:     { padding: 4 },
  backTxt:     { fontSize: 14, fontWeight: '600', color: C.blueLight },
  headerCenter:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon:  { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: C.text0 },
  liveRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  liveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  liveTxt:     { fontSize: 10, color: C.green, fontWeight: '500' },
  suggestions: { marginTop: 16, gap: 6 },
  suggestionsLabel: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  suggestionBtn:    { backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', padding: 10 },
  suggestionTxt:    { fontSize: 12, color: C.blueLight, fontWeight: '500' },
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: C.bg1, borderTopWidth: 1, borderTopColor: C.border },
  input:       { flex: 1, backgroundColor: C.bg2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.text0, maxHeight: 100, borderWidth: 1, borderColor: C.border },
  sendBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnOff:  { opacity: 0.35 },
  sendBtnTxt:  { fontSize: 18, fontWeight: '700', color: 'white', lineHeight: 22 },
});

const mb = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser:   { flexDirection: 'row-reverse' },
  av:        { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:    { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser:{ backgroundColor: '#3b82f6', borderBottomRightRadius: 4 },
  bubbleAI:  { backgroundColor: '#151c30', borderWidth: 1, borderColor: '#1e2d47', borderBottomLeftRadius: 4 },
  txt:       { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  txtUser:   { color: 'white' },
});

const td = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  av:    { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', alignItems: 'center', justifyContent: 'center' },
  bubble:{ backgroundColor: '#151c30', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#475569' },
});
