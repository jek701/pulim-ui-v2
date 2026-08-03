export type Currency = 'UZS' | 'USD' | 'EUR' | 'RUB' | 'GBP' | 'CNY' | 'KZT' | 'TRY' | 'AED' | 'JPY';
export type FamilyRelation = 'spouse' | 'child' | 'parent' | 'sibling' | 'other';

export interface FamilyMember {
  id: string;
  name: string;
  birthday: string; // YYYY-MM-DD
  relation: FamilyRelation;
}

export interface SalarySource {
  id: string;
  name: string;   // e.g. "Main job", "Freelance"
  day: number;    // 1–31
  amount?: number; // approximate monthly amount in UZS
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AiChat {
  id: string;
  userId: string;
  title: string;
  messages: AiChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface HomeWidgetSetting {
  id: 'balance' | 'askAi' | 'budget' | 'forecast' | 'exchangeRates' | 'recent';
  enabled: boolean;
}

export type PlannedExpenseVisibility = 'hidden' | '7d' | '14d' | 'this_month' | 'next_month';

export interface UserSettings {
  cardOrder?: string[];
  plannedExpenseVisibility?: PlannedExpenseVisibility;
  /** Open the new transaction form once when the app starts. Defaults to true. */
  openTransactionOnLaunch?: boolean;
}

export type SubscriptionTier = 'free' | 'premium';
export type AuthMethod = 'telegram' | 'email' | 'google' | 'apple' | 'phone';

export interface SubscriptionState {
  tier: SubscriptionTier;
  /** When the premium plan ends. For trials this is the trial deadline; for paid it's the period end. */
  premiumUntil?: number;
  /** Whether the current premium grant came from the rollout trial (vs a paid purchase). */
  isTrial?: boolean;
  trialGrantedAt?: number;
  source?: 'trial' | 'atmos' | 'none';
  billingVersion?: number;
  lastOrderId?: string;
}

export interface UsageState {
  /** Counter for the current month window. Reset when periodStart rolls over. */
  aiMessagesThisPeriod: number;
  /** Separate Premium fair-use counter so a trial does not consume the free allowance. */
  aiPremiumMessagesThisPeriod?: number;
  /** ms timestamp of the start of the current monthly window. */
  periodStart: number;
}

export interface UserProfile {
  name?: string;
  salarySources: SalarySource[];  // replaces single salaryDay
  birthday?: string;         // YYYY-MM-DD
  familyMembers: FamilyMember[];
  financialGoals: string[];  // goal IDs
  onboardingComplete: boolean;
  telegramChatIds?: number[]; // All Telegram chat IDs ever used (arrayUnion, never overwritten)
  isTelegramUser?: boolean;   // true when the account was created via Telegram anonymous auth
  linkedAuthMethods?: AuthMethod[];
  primaryAuthMethod?: AuthMethod | null;
  lastAuthMethod?: AuthMethod | null;
  legacyEmailLoginAllowed?: boolean;
  authMigrationCompleted?: boolean;
  /** True once the user linked Telegram or dismissed the "connect Telegram" prompt. */
  telegramLinkPromptDismissed?: boolean;
  phoneNumberMasked?: string;
  authMethodsUpdatedAt?: number;
  homeWidgets?: HomeWidgetSetting[]; // ordered widget config for the Home screen
  language?: 'en' | 'ru' | 'uz';
  telegramQuickEntryEnabled?: boolean;
  /** Authoritative premium flag. All UI gating reads from this field. */
  isPremium?: boolean;
  subscription?: SubscriptionState;
  usage?: UsageState;
  updatedAt: number;
}
export type TransactionType = 'income' | 'expense';
export type CategoryType = 'income' | 'expense' | 'both';
export type DebtDirection = 'i_owe' | 'owe_me';
export type CommissionType = 'percent' | 'fixed';
export type Tab = 'home' | 'transactions' | 'cards' | 'subscriptions' | 'charts' | 'settings' | 'calendar';
export type RecurrenceType = 'once' | 'daily' | 'monthly' | 'weekly' | 'weekends' | 'weekdays' | 'yearly' | 'custom';

export type CustomUnit = 'day' | 'week' | 'month' | 'year';

export interface PlannedExpense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId?: string;
  icon: string;
  recurrence: RecurrenceType;
  dayOfMonth?: number;
  dayOfWeek?: number[];
  date?: number; // anchor date — used by 'once', 'yearly', and 'custom'
  customInterval?: number; // every N units (custom)
  customUnit?: CustomUnit;
  endDate?: number; // optional last day the rule applies (inclusive)
  kind?: 'income' | 'expense';
  createdAt: number;
}
export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  icon: string;
  amount: number;
  currency: Currency;
  cycle: BillingCycle;
  nextBillingDate: number; // timestamp
  categoryId?: string;
  note?: string;
  isActive: boolean;
  userId: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  userId: string;
  createdAt: number;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  userId: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  cardId?: string;
  comment?: string;
  source?: 'debt_payment' | 'savings' | 'transfer' | 'deposit_interest' | 'deposit_close' | 'deposit_replenish' | 'deposit_withdraw' | 'return' | 'subscription';
  origin?: 'telegram';
  sourceLabel?: string;
  toCardId?: string;
  toAmount?: number;
  toCurrency?: Currency;
  linkedTransactionId?: string; // for returns: points to original transaction
  returnedAmount?: number;       // on original transaction: cumulative returned amount
  baseAmount?: number;           // amount converted to base currency (UZS) at transaction time
  fxRate?: number;               // 1 unit of `currency` = fxRate units of UZS, snapshot at create time
  fxRateSource?: 'NBU' | 'manual';
  date: number;
  userId: string;
  createdAt: number;
}

export type CardType = 'credit' | 'debit' | 'cash';
export type CapitalizationType = 'monthly' | 'quarterly' | 'at_end' | 'custom';

export interface DepositTranche {
  amount: number;  // positive = top-up, negative = withdrawal
  date: number;    // timestamp (ms)
}

export interface Card {
  id: string;
  cardType: CardType;
  name: string;
  bank: string;
  currency: Currency;
  balance: number;       // debit/cash: current balance; credit: debt used
  includeInTotalBalance?: boolean; // debit/cash only; undefined means included
  limit?: number;        // credit only
  dueDay?: number;       // credit only (1–31)
  userId: string;
  createdAt: number;
}

export interface Budget {
  id: string;          // stored as `${userId}_${categoryId}`
  categoryId: string;  // '__income__' for salary target
  amount: number;
  currency: Currency;
  userId: string;
  updatedAt: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  savedAmount: number;
  currency: Currency;
  deadline: number;  // timestamp
  userId: string;
  createdAt: number;
}

export interface Commission {
  type: CommissionType;
  value: number;
}

export interface Debt {
  id: string;
  direction: DebtDirection;
  person: string;
  amount: number;
  paidAmount: number;
  currency: Currency;
  commission?: Commission;
  dueDate?: number;
  comment?: string;
  isPaid: boolean;
  userId: string;
  createdAt: number;
}

export interface Deposit {
  id: string;
  userId: string;
  bank: string;
  amount: number;              // principal
  currency: Currency;
  interestRate: number;        // annual %
  startDate: number;           // timestamp
  endDate: number;             // timestamp
  capitalization: CapitalizationType;
  customCapitalizationDays?: number; // used when capitalization === 'custom'
  showInterest: boolean;       // whether to display accrued interest on the card
  interestToAccountId?: string; // account to auto-receive periodic interest payouts
  interestPaidOut: number;     // cumulative interest already collected
  lastInterestPaidAt?: number; // timestamp of last periodic collection
  isReplenishable: boolean;    // whether the user can top up the principal
  tranches?: DepositTranche[]; // top-ups (+) and withdrawals (-) after initial deposit
  isClosed: boolean;
  closedAt?: number;
  createdAt: number;
}
