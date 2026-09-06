// app/lib/subscription.js
// Mocked subscription system for demo purposes — no real payment processor.
// "Subscribing" just flips a flag on the user's row in Supabase.
import { supabase } from '@/lib/supabase';

export const FREE_TIER_DAILY_AI_LIMIT = 5;

export async function getSubscriptionStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { tier: 'free', isPremium: false, messagesLeft: 0, dailyLimit: FREE_TIER_DAILY_AI_LIMIT };

  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier, ai_messages_today, ai_messages_date')
    .eq('id', user.id)
    .maybeSingle();

  const isPremium = profile?.subscription_tier === 'premium';
  const today = new Date().toISOString().slice(0, 10);
  const usedToday = profile?.ai_messages_date === today ? (profile?.ai_messages_today || 0) : 0;

  return {
    tier: profile?.subscription_tier || 'free',
    isPremium,
    messagesUsedToday: usedToday,
    messagesLeft: isPremium ? Infinity : Math.max(0, FREE_TIER_DAILY_AI_LIMIT - usedToday),
    dailyLimit: FREE_TIER_DAILY_AI_LIMIT,
  };
}

/**
 * Call this BEFORE sending a message to the AI assistant.
 * Returns { allowed: boolean, messagesLeft: number }.
 * If allowed, it also increments the counter (so the check + increment
 * happen together — call this once per message, not per render).
 */
export async function checkAndConsumeAIMessage() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, messagesLeft: 0 };

  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier, ai_messages_today, ai_messages_date')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.subscription_tier === 'premium') {
    return { allowed: true, messagesLeft: Infinity };
  }

  const today = new Date().toISOString().slice(0, 10);
  const usedToday = profile?.ai_messages_date === today ? (profile?.ai_messages_today || 0) : 0;

  if (usedToday >= FREE_TIER_DAILY_AI_LIMIT) {
    return { allowed: false, messagesLeft: 0 };
  }

  const newCount = usedToday + 1;
  await supabase
    .from('users')
    .update({ ai_messages_today: newCount, ai_messages_date: today })
    .eq('id', user.id);

  return { allowed: true, messagesLeft: FREE_TIER_DAILY_AI_LIMIT - newCount };
}

/**
 * Mocked "purchase" — no payment processor, just flips the flag.
 * In a real app this would be replaced by a RevenueCat/Stripe purchase
 * callback that only sets this after a verified payment.
 */
export async function mockSubscribeToPremium() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from('users')
    .update({ subscription_tier: 'premium' })
    .eq('id', user.id);

  return { success: !error, error: error?.message };
}

/**
 * Mocked cancellation — for demo completeness, so you can show both
 * directions without needing to reset the database manually.
 */
export async function mockCancelPremium() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from('users')
    .update({ subscription_tier: 'free' })
    .eq('id', user.id);

  return { success: !error, error: error?.message };
}
