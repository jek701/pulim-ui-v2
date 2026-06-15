import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Query-key factory. All keys are scoped by user id so switching users isolates cache. */
export const qk = {
  profile: (uid: string) => ['profile', uid] as const,
  settings: (uid: string) => ['settings', uid] as const,
  transactions: (uid: string) => ['transactions', uid] as const,
  cards: (uid: string) => ['cards', uid] as const,
  categories: (uid: string) => ['categories', uid] as const,
  subcategories: (uid: string) => ['subcategories', uid] as const,
  budgets: (uid: string) => ['budgets', uid] as const,
  savingsGoals: (uid: string) => ['savingsGoals', uid] as const,
  subscriptions: (uid: string) => ['subscriptions', uid] as const,
  plannedExpenses: (uid: string) => ['plannedExpenses', uid] as const,
  debts: (uid: string) => ['debts', uid] as const,
  deposits: (uid: string) => ['deposits', uid] as const,
  aiChats: (uid: string) => ['aiChats', uid] as const,
};
