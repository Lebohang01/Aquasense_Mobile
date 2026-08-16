// app/components/VerifyReading.js
// Trust & data quality: crowd-verified readings
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  bg2: '#151c30', bg3: '#1c2540',
  green: '#22c55e', red: '#ef4444', blueLight: '#60a5fa',
  text0: '#f1f5f9', text1: '#94a3b8', text2: '#475569',
  border: '#1e2d47',
};

export default function VerifyReading({ nodeId }) {
  const [counts, setCounts] = useState({ up: 0, down: 0 });
  const [myVote, setMyVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: votes } = await supabase
        .from('node_verifications')
        .select('vote, user_id')
        .eq('node_id', nodeId)
        .gte('created_at', since);

      const up = (votes || []).filter(v => v.vote === 'up').length;
      const down = (votes || []).filter(v => v.vote === 'down').length;
      setCounts({ up, down });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const mine = (votes || []).find(v => v.user_id === user.id);
        setMyVote(mine ? mine.vote : null);
      }
    } catch {
      // fail quietly — this is a nice-to-have widget, not critical path
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { load(); }, [load]);

  const castVote = async (vote) => {
    if (myVote || submitting) return; // already voted today, or mid-submit
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('node_verifications')
        .insert({ node_id: nodeId, user_id: user.id, vote });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already voted', "You've already confirmed this node today.");
        } else {
          Alert.alert('Could not submit', error.message);
        }
      } else {
        setMyVote(vote);
        setCounts(prev => ({ ...prev, [vote]: prev[vote] + 1 }));
        Alert.alert('Thanks!', '+5 points for helping verify this water point.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const total = counts.up + counts.down;
  const upPct = total > 0 ? Math.round((counts.up / total) * 100) : null;

  return (
    <View style={s.card}>
      <Text style={s.title}>Community Check</Text>
      <Text style={s.subtitle}>
        {loading ? 'Loading...' : total > 0
          ? `${upPct}% of ${total} student${total !== 1 ? 's' : ''} confirmed this in the last 24h`
          : 'No community reports yet today — be the first'}
      </Text>

      <View style={s.buttonRow}>
        <TouchableOpacity
          style={[s.voteBtn, myVote === 'up' && s.voteBtnActiveGood]}
          onPress={() => castVote('up')}
          disabled={!!myVote || submitting}
        >
          <Text style={s.voteEmoji}>👍</Text>
          <Text style={[s.voteLabel, myVote === 'up' && { color: C.green }]}>
            Looks fine ({counts.up})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.voteBtn, myVote === 'down' && s.voteBtnActiveBad]}
          onPress={() => castVote('down')}
          disabled={!!myVote || submitting}
        >
          <Text style={s.voteEmoji}>👎</Text>
          <Text style={[s.voteLabel, myVote === 'down' && { color: C.red }]}>
            Something's off ({counts.down})
          </Text>
        </TouchableOpacity>
      </View>

      {myVote && (
        <Text style={s.votedNote}>
          ✓ You confirmed "{myVote === 'up' ? 'looks fine' : "something's off"}" today
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  title:       { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  subtitle:    { fontSize: 12, color: C.text1, marginBottom: 12 },
  buttonRow:   { flexDirection: 'row', gap: 10 },
  voteBtn:     { flex: 1, backgroundColor: C.bg3, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  voteBtnActiveGood: { borderColor: C.green + '77', backgroundColor: 'rgba(34,197,94,0.08)' },
  voteBtnActiveBad:  { borderColor: C.red + '77', backgroundColor: 'rgba(239,68,68,0.08)' },
  voteEmoji:   { fontSize: 20, marginBottom: 4 },
  voteLabel:   { fontSize: 11, fontWeight: '700', color: C.text1 },
  votedNote:   { fontSize: 11, color: C.blueLight, marginTop: 10, textAlign: 'center' },
});
