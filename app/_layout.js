import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { registerForPushNotifications } from '@/utils/messaging';
import { supabase } from '@/lib/supabase';
import LockScreen from '@/components/LockScreen';
import { getBiometricPreference } from '@/lib/biometricAuth';


function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      // Check onboarding status before deciding where to send them
      supabase.from('users').select('has_seen_onboarding').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data && !data.has_seen_onboarding) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        });
    }
  }, [user, loading, segments]);

  // Register push token once we actually have a logged-in user
  useEffect(() => {
    if (user) {
      registerForPushNotifications().catch(() => {});
    }
  }, [user]);

  return children;
}

export default function RootLayout() {
const [locked, setLocked] = useState(false);

  useEffect(() => {
    getBiometricPreference().then(enabled => setLocked(enabled));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const enabled = await getBiometricPreference();
        if (enabled) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            {/* <Stack.Screen name="community" options={{ animation: 'none' }} /> */}
            <Stack.Screen name="admin" options={{ animation: 'none' }} />
            <Stack.Screen name="node/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="ai-assistant/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="upgrade/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="leaderboard/index" options={{ presentation: 'modal' }} />
            <Stack.Screen name="onboarding/index" />
          </Stack>
        </AuthGate>
         {locked && <LockScreen onUnlock={() => setLocked(false)} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}