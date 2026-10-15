// lib/campus.js
// One place for campus names and for keeping the chosen campus in sync
// between sign-up, the Home screen and Settings.
import { supabase } from '@/lib/supabase';

let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}

export const CAMPUSES = ['UJ APK', 'UJ APB', 'UJ SWC', 'UJ DFC'];

// Accepts 'APK', 'uj apk', 'UJ APK' ... returns 'UJ APK' (or null)
export function normalizeCampus(v) {
  if (!v) return null;
  const up = String(v).trim().toUpperCase();
  const full = up.startsWith('UJ ') ? up : `UJ ${up}`;
  return CAMPUSES.includes(full) ? full : null;
}

const KEY = 'pending_campus_choice';

// Remember the campus picked on the sign-up form. The user usually has no
// session yet (email confirmation), so it is saved to their profile the first
// time they are signed in.
export async function setPendingCampus(campus) {
  try { await AsyncStorage?.setItem(KEY, campus); } catch {}
}

export async function applyPendingCampus(userId) {
  try {
    const pending = normalizeCampus(await AsyncStorage?.getItem(KEY));
    if (!pending) return;
    const { error } = await supabase.from('users')
      .update({ campus_preference: pending }).eq('id', userId);
    if (!error) await AsyncStorage?.removeItem(KEY);
  } catch {}
}

// Last known campus of this phone's user. Lets the login screen open on the
// right campus even though nobody is signed in there.
const CACHE_KEY = 'last_campus';

export async function cacheCampus(campus) {
  try { if (normalizeCampus(campus)) await AsyncStorage?.setItem(CACHE_KEY, normalizeCampus(campus)); } catch {}
}

export async function getCachedCampus() {
  try { return normalizeCampus(await AsyncStorage?.getItem(CACHE_KEY)); } catch { return null; }
}

// The user's saved campus ('UJ APK' ...) or null if none chosen
export async function getCampusPreference(userId) {
  await applyPendingCampus(userId);
  const { data } = await supabase.from('users')
    .select('campus_preference').eq('id', userId).maybeSingle();
  const pref = normalizeCampus(data?.campus_preference);
  if (pref) cacheCampus(pref);
  return pref;
}
