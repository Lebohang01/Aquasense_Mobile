// app/app/admin/_layout.js
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AdminLayout() {
  const router  = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed,  setAllowed]  = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login'); return; }

      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (data?.role === 'admin') {
        setAllowed(true);
      } else {
        router.replace('/(tabs)');
      }
      setChecking(false);
    }
    checkAdmin();
  }, []);

  if (checking) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={s.txt}>Verifying admin access...</Text>
      </View>
    );
  }

  if (!allowed) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="users" />
      <Stack.Screen name="nodes" />
      <Stack.Screen name="campuses" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0a0e1a', alignItems: 'center', justifyContent: 'center', gap: 12 },
  txt:    { fontSize: 14, color: '#94a3b8' },
});
