import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { registerForPushNotifications } from '@/utils/messaging';

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments]);

  return children;
}

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            //<Stack.Screen name="community" options={{ animation: 'none' }} />
            <Stack.Screen name="admin" options={{ animation: 'none' }} />
            <Stack.Screen name="node/[id]" options={{ presentation: 'card' }} />
          </Stack>
        </AuthGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}