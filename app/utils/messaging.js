// app/utils/messaging.js
//import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';
import { supabase }       from '@/lib/supabase';

function getNotifications() {
  return require('expo-notifications');
}

export async function registerForPushNotifications() {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) {
    console.log('[Push] Skipping push registration in Expo Go');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] Physical device required');
    return null;
  }

  const Notifications = getNotifications(); // only loaded in real builds

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:             'AquaSense Alerts',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#3b82f6',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission denied');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('[Push] No EAS projectId found');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Push] Token:', token);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ push_token: token }).eq('id', user.id);
    }

    return token;
  } catch (err) {
    console.warn('[Push] Could not get push token:', err.message);
    return null;
  }
}

export function setupNotificationResponseHandler(onResponse) {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) return { remove: () => {} }; // no-op subscription

  const Notifications = getNotifications();
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (onResponse) onResponse(data);
  });
}