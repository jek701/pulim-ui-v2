import { useMemo } from 'react';
import { useApp } from '../context';
import type { UserProfile, SubscriptionTier } from '../types';

/** Source of truth for premium access: the `isPremium` boolean on the user's profile. */
function readIsPremium(profile: UserProfile | null): boolean {
  return profile?.isPremium === true;
}

export const FREE_LIMITS = {
  cards: 1,
  allowedCardTypes: ['debit'] as const,
  aiMessagesPerMonth: 10,
  aiChats: 1,
  subscriptions: 2,
  aiModel: 'claude-haiku-4-5-20251001',
} as const;

export const PREMIUM_LIMITS = {
  aiModel: 'claude-sonnet-4-6',
} as const;

const MONTH_MS = 30 * 86_400_000;

function currentPeriodStart(profile: UserProfile | null): number {
  const stored = profile?.usage?.periodStart;
  if (stored && Date.now() - stored < MONTH_MS) return stored;
  return Date.now();
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

  return useMemo(() => {
    const premium = readIsPremium(profile);
    const tier: SubscriptionTier = premium ? 'premium' : 'free';
    const aiPeriodStart = currentPeriodStart(profile);
    const aiUsed = (profile?.usage?.periodStart && Date.now() - profile.usage.periodStart < MONTH_MS)
      ? profile.usage.aiMessagesThisPeriod ?? 0
      : 0;

    const isPremium = premium;
    const isTrial = !!profile?.subscription?.isTrial && premium;
    const trialDaysLeft = profile?.subscription?.premiumUntil
      ? Math.max(0, Math.ceil((profile.subscription.premiumUntil - Date.now()) / 86_400_000))
      : null;

    const aiRemaining = isPremium ? Infinity : Math.max(0, FREE_LIMITS.aiMessagesPerMonth - aiUsed);
    const aiModel: string = isPremium ? PREMIUM_LIMITS.aiModel : FREE_LIMITS.aiModel;

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
      aiModel,
      canUse,
      incrementAiUsage,
    };
  }, [profile]);
}
