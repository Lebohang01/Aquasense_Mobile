// app/lib/biometricAuth.js
// Biometric acts as a LOCAL APP LOCK on top of an existing Supabase
// session — it does not replace email/password login with Supabase.
// This is the standard mobile pattern: log in once normally, then use
// Face ID/fingerprint to quickly unlock the app on subsequent opens.
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = 'aquasense_biometric_enabled';

export async function isBiometricAvailable() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function getBiometricPreference() {
  const value = await AsyncStorage.getItem(PREF_KEY);
  return value === 'true';
}

export async function setBiometricPreference(enabled) {
  await AsyncStorage.setItem(PREF_KEY, enabled ? 'true' : 'false');
}

export async function authenticateWithBiometrics() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AquaSense',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}
