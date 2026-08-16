// app/components/CheckInButton.js
// Civic engagement: check-ins drive points, streaks, and the sustainability counter
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

const C = {
  blue: '#3b82f6', blueLight: '#60a5fa',
  green: '#22c55e', text0: '#f1f5f9', text1: '#94a3b8',
};

export default function CheckInButton({ nodeId, nodeName }) {
  const [checking, setChecking] = useState(false);

  const handleCheckIn = async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not logged in', 'Please log in to check in.');
        return;
      }

      // Simple client-side cooldown: don't allow re-check-in at the same
      // node within 30 minutes (avoids trivial point farming)
      const { data: recent } = await supabase
        .from('check_ins')
        .select('created_at')
        .eq('node_id', nodeId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent) {
        const minutesAgo = (Date.now() - new Date(recent.created_at).getTime()) / 60000;
        if (minutesAgo < 30) {
          Alert.alert('Already checked in', `You checked in here ${Math.round(minutesAgo)} min ago. Try again later.`);
          return;
        }
      }

      const { error } = await supabase
        .from('check_ins')
        .insert({ node_id: nodeId, user_id: user.id });

      if (error) {
        Alert.alert('Could not check in', error.message);
      } else {
        Alert.alert('Checked in! 💧', `+10 points for refilling at ${nodeName || 'this water point'}.`);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <TouchableOpacity style={s.btn} onPress={handleCheckIn} disabled={checking}>
      {checking
        ? <ActivityIndicator size="small" color="#fff" />
        : (
          <>
            <Text style={s.emoji}>💧</Text>
            <Text style={s.label}>Check In Here</Text>
          </>
        )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn:   { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji: { fontSize: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
