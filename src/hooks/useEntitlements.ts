import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import type { UserProfile, SubscriptionTier } from '../types';

/** `isPremium` is a compatibility cache; the paid/trial deadline is authoritative. */
function readIsPremium(profile: UserProfile | null, now: number): boolean {
  const premiumUntil = profile?.subscription?.premiumUntil;
  return profile?.isPremium === true
    && typeof premiumUntil === 'number'
    && premiumUntil > now;
}

export const FREE_LIMITS = {
  cards: 1,
  allowedCardTypes: ['debit'] as const,
  aiMessagesPerMonth: 10,
  aiChats: 1,
  subscriptions: 2,
} as const;

const MONTH_MS = 30 * 86_400_000;

function currentPeriodStart(profile: UserProfile | null, now: number): number {
  const stored = profile?.usage?.periodStart;
  if (stored && now - stored < MONTH_MS) return stored;
  return now;
}

export type FeatureKey =
  | 'extra_cards' | 'credit_cash_cards'
  | 'custom_categories' | 'budgets'
  | 'debts_create' | 'deposits_create' | 'savings_create'
  | 'planned_expenses' | 'advanced_charts'
  | 'advanced_filters' | 'ai_chat' | 'ai_extra_chats'
  | 'extra_subscriptions';

export function useEntitlements() {
  const { profile } = useApp();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const premium = readIsPremium(profile, now);
    const tier: SubscriptionTier = premium ? 'premium' : 'free';
    const aiPeriodStart = currentPeriodStart(profile, now);
    const aiUsed = (profile?.usage?.periodStart && now - profile.usage.periodStart < MONTH_MS)
      ? profile.usage.aiMessagesThisPeriod ?? 0
      : 0;

    const isPremium = premium;
    const isTrial = !!profile?.subscription?.isTrial && premium;
    const trialDaysLeft = profile?.subscription?.premiumUntil
      ? Math.max(0, Math.ceil((profile.subscription.premiumUntil - now) / 86_400_000))
      : null;

    const aiRemaining = isPremium ? Infinity : Math.max(0, FREE_LIMITS.aiMessagesPerMonth - aiUsed);
    const canUse = (feature: FeatureKey, count?: number): boolean => {
      if (isPremium) return true;
      switch (feature) {
        case 'extra_cards':
          return (count ?? 0) < FREE_LIMITS.cards;
        case 'extra_subscriptions':
          return (count ?? 0) < FREE_LIMITS.subscriptions;
        case 'credit_cash_cards':
        case 'custom_categories':
        case 'budgets':
        case 'debts_create':
        case 'deposits_create':
        case 'savings_create':
        case 'planned_expenses':
        case 'advanced_charts':
        case 'advanced_filters':
        case 'ai_extra_chats':
          return false;
        case 'ai_chat':
          return aiRemaining > 0;
      }
    };

    // AI usage is now metered server-side (inside the /v1/ai/chat transaction).
    // Kept as a no-op so existing callers stay valid; refetch the profile to see
    // the updated counter.
    const incrementAiUsage = async () => {};

    return {
      tier,
      isPremium,
      isTrial,
      trialDaysLeft,
      limits: FREE_LIMITS,
      aiUsed,
      aiRemaining,
      aiPeriodStart,
      canUse,
      incrementAiUsage,
    };
  }, [now, profile]);
}
