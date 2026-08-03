# Pulim Project Context for AI

This file is a compact technical map of the Pulim codebase. It is intended to help future AI/code agents understand the project quickly without re-reading every file.

Last reviewed: 2026-07-15.

## Product Summary

Pulim is a mobile-first personal finance tracker built for Uzbekistan users, with UZS as the base currency. It is designed to run as a Telegram Mini App and as a PWA. The app tracks income, expenses, accounts, cards, cash wallets, subscriptions, planned expenses/income, debts, savings goals, deposits, budgets, exchange rates, and AI financial analysis.

Core business idea:

- Give users a daily finance dashboard that combines account balances, monthly income/expense, budgets, subscriptions, debts, planned expenses, and recent transactions.
- Keep the main input flow fast: add transaction, return/refund, transfer, pay debt, collect deposit interest, replenish/withdraw deposit, contribute to savings.
- Offer premium features such as multiple/advanced accounts, credit/cash accounts, custom categories, budgets, debts, deposits, savings, planned expenses, charts, advanced filters, and AI chat.
- Support Telegram Mini App constraints: viewport height, safe areas, theme colors, auth via Telegram custom token API, and compact mobile layout.

## Tech Stack

- Frontend: React 19, TypeScript, Vite 8.
- Styling: CSS Modules plus global CSS variables in `src/global.css`.
- Backend/data: Firebase Auth and Firestore.
- PWA: `vite-plugin-pwa` with Firebase Hosting output from `dist`.
- i18n: `i18next`, `react-i18next`, locales in `src/i18n`.
- Charts: `recharts`.
- Drag/drop: `@dnd-kit/*`.
- Icons: `react-icons/hi2`.
- AI: OpenAI Responses API through the separate `pulim-api-v2` backend; the browser only consumes the app's SSE stream.
- Dates: `dayjs` with localized format plugin.

## Commands

- `npm run dev`: start Vite dev server.
- `npm run build`: TypeScript build plus production Vite/PWA build.
- `npm run lint`: ESLint.
- `npm run preview`: serve production build locally.

## Environment Variables

Configured in `.env` or deployment environment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_TELEGRAM_AUTH_API_URL`
- No model-provider key belongs in Vite. `OPENAI_API_KEY` is configured only in `pulim-api-v2`.

`src/firebase.ts` exports `firebaseConfigured`, `firebaseProjectId`, `firebaseAuthDomain`, `db`, and `auth`. If Firebase env vars are missing, `App.tsx` renders a setup screen instead of the app.

## Entry Points and App Shell

- `src/main.tsx`
  - Imports global CSS and i18n.
  - Bootstraps Telegram Mini App via `window.Telegram.WebApp`.
  - Applies light/dark theme from Telegram or system preference.
  - Sets CSS vars `--vh` and `--tg-top` for mobile/Telegram viewport stability.
  - Renders `<App />` in React `StrictMode`.

- `src/App.tsx`
  - Checks `firebaseConfigured`.
  - Wraps authenticated app in `AppProvider`.
  - Shows `AuthLanguageSelector` and `Login` when unauthenticated.
  - Shows tabbed app shell with `BottomNav` when authenticated.
  - Routes by context `activeTab`, not by URL routing.

- `src/context.tsx`
  - Global app state: Firebase user, auth loading, Telegram auth status, active tab, category filter, profile, and profile saving.
  - Listens to Firebase Auth with `onAuthStateChanged`.
  - Auto-auths Telegram users by POSTing Telegram init data to `VITE_TELEGRAM_AUTH_API_URL`, then `signInWithCustomToken`.
  - Syncs auth metadata to `profiles/{uid}`.
  - Seeds every profile with a 30-day premium trial if `isPremium` is undefined.
  - Stores Telegram chat mapping in `telegramUsers/{chatId}` and appends `telegramChatIds` to profile.

## Navigation

Tabs are defined by `Tab` in `src/types.ts`:

- `home`
- `transactions`
- `cards`
- `subscriptions`
- `charts`
- `calendar`
- `settings`

`BottomNav.tsx` maps the visible tabs. The `cards` tab renders the `Accounts` page, which internally switches between account types, savings, and debts.

## Firestore Security Model

`firestore.rules`:

- `profiles/{userId}`: read/write only if `request.auth.uid == userId`.
- `userSettings/{userId}`: same user-owned document pattern.
- `telegramUsers/{chatId}`: write if authenticated UID equals `request.resource.data.uid`; read if UID equals existing `resource.data.uid`.
- All other collections: require `userId` field and allow access only to matching authenticated user.

This means almost every collection document must include a `userId` field.

## Main Firestore Collections

- `profiles`
  - Document id is Firebase UID.
  - Stores onboarding/profile, Telegram data, auth metadata, home widget config, premium/trial/usage state.

- `userSettings`
  - Document id is Firebase UID.
  - Stores cross-feature UI settings such as `cardOrder` and `plannedExpenseVisibility`.

- `telegramUsers`
  - Document id is Telegram chat/user id.
  - Maps Telegram chat/user id to Firebase UID.

- `transactions`
  - Income, expense, transfers, returns/refunds, debt payments, savings contributions, deposit movements, subscription payments.
  - Transfers are stored as a transaction with `source: 'transfer'`, `type: 'expense'`, `cardId` as source account, and `toCardId`/`toAmount`/`toCurrency` for destination.
  - Summary calculations should exclude transfers from income/expense totals.

- `cards`
  - Debit cards, credit cards, and cash wallets.
  - Debit/cash `balance` is available money.
  - Credit `balance` represents used debt; signs are inverted when applying expenses/income/transfers.
  - `includeInTotalBalance` applies to debit/cash total balance.

- `categories`, `subcategories`
  - Categories support `income`, `expense`, or `both`.
  - Defaults are seeded by `useCategories` when a user has no categories.

- `budgets`
  - One budget per user/category id, doc id `${userId}_${categoryId}`.
  - Special category ids: `__income__`, `__debts__`, `__subscription__`.

- `subscriptions`
  - Recurring services with amount, currency, cycle, next billing date, category, active state.

- `planned_expenses`
  - Planned future/recurring income or expense rules.
  - Supports `once`, `daily`, `weekly`, `monthly`, `weekends`, `weekdays`, `yearly`, and `custom`.

- `debts`
  - Tracks money user owes or is owed, paid amount, optional commission, due date, paid state.

- `savingsGoals`
  - Target amount, saved amount, currency, deadline.

- `deposits`
  - Principal, interest rate, dates, capitalization mode, optional payout account, paid interest, top-up/withdraw tranches, closed state.

- `aiChats`
  - Chat title, messages, timestamps.

## Domain Types

Primary type definitions live in `src/types.ts`.

Important unions:

- `Currency`: `UZS`, `USD`, `EUR`, `RUB`, `GBP`, `CNY`, `KZT`, `TRY`, `AED`, `JPY`.
- `TransactionType`: `income` or `expense`.
- `CardType`: `credit`, `debit`, `cash`.
- `CategoryType`: `income`, `expense`, `both`.
- `DebtDirection`: `i_owe`, `owe_me`.
- `RecurrenceType`: `once`, `daily`, `monthly`, `weekly`, `weekends`, `weekdays`, `yearly`, `custom`.
- `AuthMethod`: `telegram`, `email`, `google`, `apple`, `phone`.
- `PlannedExpenseVisibility`: `hidden`, `7d`, `14d`, `this_month`, `next_month`.

Important source values on `Transaction.source`:

- `transfer`
- `return`
- `subscription`
- `debt_payment`
- `savings`
- `deposit_interest`
- `deposit_close`
- `deposit_replenish`
- `deposit_withdraw`

## Hooks and Data Access Pattern

Most hooks follow this pattern:

1. Accept `userId: string | null`.
2. If no user, clear local state and stop loading.
3. Subscribe to Firestore via `onSnapshot(query(collection(db, ...), where('userId', '==', userId)))`.
4. Sort data client-side.
5. Expose CRUD helpers that write `userId`, timestamps, and clean undefined values where needed.

Key hooks:

- `useTransactions`
  - CRUD for `transactions`.
  - `clearAll` deletes all user transactions using a batch.
  - Ordinary income/expense updates use `PATCH /transactions/:id`.
  - Transfers and returns use dedicated atomic update endpoints so both account legs
    and the original transaction's `returnedAmount` stay consistent.

- `useCards`
  - CRUD and `adjustBalance`.
  - Reads/writes `cardOrder` in `userSettings`.
  - Uses delayed listener setup to avoid React StrictMode Firestore listener crash.

- `useCategories`
  - Reads categories and subcategories.
  - Seeds default categories if empty.

- `useBudgets`
  - Reads budgets and upserts budgets by deterministic doc id.

- `useUserSettings`
  - Reads `userSettings/{uid}`.
  - Default planned expense visibility is `this_month`.

- `useEntitlements`
  - Reads premium access from `profile.isPremium`.
  - Free limits: 1 debit card, 2 subscriptions, 10 AI messages/month, 1 AI chat.
  - Model routing is server-owned. The current API defaults are `gpt-5.6-terra` for Premium and `gpt-5.4-mini` for free users.
  - Usage is reserved and enforced by the API; the frontend refetches the profile after a completed answer.

- `useAiChats`
  - Stores AI chat history in `aiChats`.

## Pages

- `Home.tsx`
  - Main dashboard.
  - Shows configurable widgets from `profile.homeWidgets`.
  - Calculates current month UZS income/expense excluding transfers.
  - Shows included account balances grouped by currency.
  - Shows budget rows, debt budget, subscription budget, forecast, exchange rates, recent transactions.
  - Handles returns/refunds and AI forecast.

- `Transactions.tsx`
  - History page with month navigation, filters, list/chart modes, summaries, edit/delete, return/refund.
  - Filters support type, category, subcategory, card, and date range.
  - Transfer type is derived from `source === 'transfer'`.
  - Summary excludes transfers and uses `baseAmount` for non-UZS if available.
  - Deleting or editing adjusts account balances to reverse/apply financial effects.
  - Business kind is derived with `getTransactionKind`: a return is never treated as
    income and a transfer is never treated as an expense by filters or editors.
  - Returns and transfers have dedicated edit modals; category/subcategory remain
    unavailable because they are not user-selected fields for those operations.

- `Accounts.tsx`
  - Container for account types plus savings and debts.
  - Has transfer flow between accounts.
  - Premium-gates savings/debts and non-basic account capabilities.

- `Cards.tsx`
  - Manages debit/credit cards.
  - Handles balance edit, transfers, credit card refill, include-in-total toggle.
  - Credit card balance means debt used.

- `Cash.tsx`
  - Manages cash wallets as cards with `cardType: 'cash'`.

- `Savings.tsx`
  - Manages savings goals and contributions.
  - Contributions create a `source: 'savings'` expense transaction and adjust account balance.

- `Debts.tsx`
  - Manages debts.
  - Payments create `source: 'debt_payment'` transactions and adjust account balances.

- `Deposits.tsx`
  - Manages deposit products.
  - Supports close, collect interest, replenish, withdraw.
  - Related movements create deposit source transactions and adjust account balances.

- `Subscriptions.tsx`
  - Manages recurring subscriptions.
  - Payment creates `source: 'subscription'` expense and advances next billing date.
  - Automatically writes a `__subscription__` monthly budget from active subscriptions.

- `Calendar.tsx`
  - Calendar view for transactions, planned expenses/income, subscriptions, debt due dates, and projected UZS balance.
  - Premium-walled.
  - Planned expense display respects `userSettings.plannedExpenseVisibility`.
  - Forecast/projection currently uses all planned expenses, not the visibility setting.

- `Charts.tsx`
  - Month charts by category and day.
  - Premium-gated chart types/features.

- `Settings.tsx`
  - Profile, language, home widget order, planned expense visibility, categories/subcategories, budgets, danger zone.
  - Custom categories and budgets are premium-gated.

- `Onboarding.tsx`
  - Financial profile setup/editing: salary sources, birthday, family members, goals.

- `Login.tsx`
  - Current visible auth flow is legacy email/password through `AuthMethodsPanel`.

## Components

- `Modal.tsx`: shared modal shell.
- `FormField.tsx`: `Field`, `Input`, `Select`, `Textarea`.
- `NumberInput.tsx`: number-only input and `BudgetInput` with save-on-blur/Enter.
- `AddTransactionModal.tsx`: main add/edit transaction form with account picker, category picker, currency conversion snapshot, and card order drag/drop.
- `ReturnModal.tsx`: picks original expense and creates a refund/return.
- `PlannedExpenseModal.tsx`: planned income/expense form with recurrence settings.
- `PremiumLock.tsx` and `PremiumModal.tsx`: premium badges, banners, walls, and modal gating.
- `AskAIWidget.tsx` and `AskAIChat.tsx`: AI entry point and chat UI.
- `HomeWidgetsSettings.tsx`: drag/drop and toggle home widgets.
- `AuthLanguageSelector.tsx`: floating language selector for auth flow.
- `AuthMethodsPanel.tsx`: currently email/password login UI.
- `BottomNav.tsx`: bottom tab navigation.
- `ExchangeRatesWidget.tsx`: CBU/NBU exchange rate widget.

## Utilities

- `utils/format.ts`
  - Money, amount, date, month, time, date input helpers.

- `utils/nbuRates.ts`
  - Fetches currency rates from `https://cbu.uz/uz/arkhiv-kursov-valyut/json/`.
  - Base currency is `UZS`.
  - Uses memory and `localStorage` cache.
  - `getRateToBase(currency, date)` returns UZS per one unit.
  - `convert(amount, from, to, date)` converts through UZS.

- `utils/recurrence.ts`
  - `plannedAppliesToDay(pe, date)` central recurrence rule evaluator.
  - Used by Calendar and AI context builders.

- `utils/ai.ts`
  - Calls the API's structured month-end forecast endpoint and returns the typed result.

- `utils/aiChat.ts`
  - Consumes the API's `meta`, `delta`, `done`, and `error` SSE events.

- `utils/defaultCategories.ts`
  - Default categories seeded for new users.

- `utils/homeWidgets.ts`
  - Defines default Home widget order and merge behavior for stored settings.

- `utils/dayjs.ts`
  - Initializes dayjs locale and exposes `setDayjsLocale`.

- `utils/importCSV.ts`
  - Hard-coded import helper/sample data, not general CSV parser.

## Auth Notes

Historical context:

- The project experimented with Google, Apple, and phone auth, then reverted visible login to old email/password only.
- Types and profile fields still include `google`, `apple`, and `phone` because auth migration metadata remains in the model.
- `AuthUpgradeModal.tsx` still exists but is not currently wired in `App.tsx`.
- Telegram auto-auth still exists in context and depends on the custom backend endpoint.

Visible login today:

- `Login.tsx` renders Pulim auth screen.
- `AuthMethodsPanel.tsx` calls `signInWithEmailAndPassword(auth, email, password)`.
- There is no visible signup UI in the current auth flow.

## Financial Rules to Preserve

- Transfers must not affect total income/expense summaries.
  - Check `source === 'transfer'`.
  - Transfer documents are currently stored as `type: 'expense'`, so every summary/chart/history calculation must explicitly handle source.

- Credit cards invert balance signs.
  - Debit/cash expense decreases balance; income increases balance.
  - Credit expense increases used debt; income/payment decreases used debt.

- Non-UZS transactions may store:
  - `baseAmount`: UZS equivalent at transaction time.
  - `fxRate`: UZS per one unit of transaction currency.
  - `fxRateSource`: `NBU` or `manual`.

- Returns/refunds:
  - Return creates an income transaction with `source: 'return'`.
  - Original expense gets `returnedAmount` incremented.
  - Account balance is adjusted according to card type.

- Debt payments:
  - Create transaction with `source: 'debt_payment'`.
  - Increment debt `paidAmount`.
  - Mark paid when paid amount reaches debt amount.

- Subscription payments:
  - Create transaction with `source: 'subscription'`.
  - Advance `nextBillingDate`.
  - Active subscription monthly total can drive `__subscription__` budget.

- Planned expenses:
  - Definitions are stored independently from transactions.
  - Calendar display can be hidden or limited by `userSettings.plannedExpenseVisibility`.
  - Projection/forecast logic may still use planned items even if hidden from display.

## Premium Model

Premium access is controlled by `profile.isPremium === true`.

Context currently seeds a 30-day premium trial for every user whose profile has `isPremium === undefined`. The optional `profile.subscription` object is used for display metadata. Premium gating should read `useEntitlements()` instead of duplicating checks.

Free limits:

- 1 card.
- Debit cards only.
- 2 subscriptions.
- 10 AI messages per 30-day window.
- 1 AI chat.

Premium-only examples:

- Credit/cash accounts.
- Custom categories.
- Budgets.
- Debts.
- Deposits.
- Savings.
- Planned expenses/calendar.
- Advanced charts/filters.
- Extra AI chats and higher AI model.

## Styling and UI Conventions

- Mobile-first layout with max root width of 430px.
- Global theme variables in `src/global.css`.
- Dark and light themes via `:root` and `:root[data-theme="light"]`.
- CSS Modules per page/component.
- Shared radius variables: `--r`, `--r-sm`, `--r-lg`.
- Bottom nav height uses `--nav` and `--nav-total`.
- Content must respect Telegram safe area via `--tg-top`.
- UI language currently mixes compact mobile finance cards, modals, chips, icon buttons, and bottom tab navigation.
- Existing typography uses Inter from Google Fonts.

## i18n

Locale files:

- `src/i18n/en.ts`
- `src/i18n/ru.ts`
- `src/i18n/uz.ts`

Initialization:

- `src/i18n/index.ts`
- Saved language key: `localStorage['lang']`.
- Fallback language is `ru`.
- Dayjs locale is updated on i18n language changes.

When adding UI text, add all three locale keys. Avoid hard-coded user-facing strings unless they are temporary errors or developer diagnostics.

## PWA and Hosting

- Vite PWA manifest is configured in `vite.config.ts`.
- App name and short name are `Pulim`.
- Public assets include `public/pulim-logo.png`, `public/favicon.png`, and app icons.
- Firebase Hosting serves `dist` and rewrites all routes to `index.html`.
- Service worker cache includes Firestore network-first and identity toolkit network-only.

## Testing and Verification

Current project scripts:

- `npm run build` is the main reliable verification command.
- `npm run lint` exists but may reveal broader existing style/unused issues depending on current code state.

There is no dedicated unit test suite in the current project.

Recommended checks after changes:

- Auth/login still renders when signed out.
- Main tabs render after login.
- Add/edit/delete transaction adjusts balances correctly.
- Transfers remain excluded from totals and charts.
- Credit card balance signs remain correct.
- Firestore writes include `userId`.
- New text exists in all i18n files.
- Mobile layout stays inside the 430px app shell and respects bottom nav.

## Telegram Premium Quick Entry

- Premium users can create ordinary income/expense transactions by messaging the bot.
- Backend-created transactions carry `origin: 'telegram'`; this is informational and
  must never be treated like the service-operation `source` field.
- `profile.language` controls bot replies and is synchronized with i18next/localStorage.
- `profile.telegramQuickEntryEnabled` is managed from Settings and defaults to enabled.
- `?tx=<transactionId>` and Telegram `start_param=tx_<transactionId>` open History and
  the existing transaction editor once, then the deep-link state is cleared.
- The public bot link uses `VITE_TELEGRAM_BOT_USERNAME`.
- Premium payment remains ATMOS-only; Telegram Stars are not used.

## Known Technical Risks and Cleanup Targets

- AI chat documents still store message arrays in one document; long-term, move messages to a paginated subcollection.
- Some auth migration code/types remain after reverting visible login to email-only.
- `README.md` is still the default Vite template and does not describe Pulim.
- The app relies heavily on client-side balance adjustments. Multi-step operations are often not Firestore transactions, so partial failures can leave data inconsistent.
- Some collection queries sort client-side; indexes are minimal.
- Several pages contain large components with dense business logic. Future refactors should be careful and incremental.
- `importCSV.ts` contains hard-coded personal/sample finance data and should be treated as a local migration helper, not production import UX.

## File/Folder Map

Root:

- `package.json`: scripts and dependencies.
- `vite.config.ts`: React plugin, PWA manifest, workbox caching, dev server allowed hosts.
- `firebase.json`: Firestore rules and hosting config.
- `firestore.rules`: security rules.
- `firestore.indexes.json`: currently has deposits index.
- `tsconfig*.json`: TypeScript configs.
- `eslint.config.js`: ESLint flat config.
- `index.html`: app HTML shell.
- `public/`: PWA and logo assets.

`src/`:

- `main.tsx`: React bootstrap, Telegram setup, theme and viewport CSS vars.
- `App.tsx`: app shell, auth gate, tab rendering.
- `context.tsx`: global app/auth/profile context.
- `firebase.ts`: Firebase initialization.
- `types.ts`: domain model.
- `global.css`: global reset, theme vars, app root sizing.
- `App.module.css`: app shell/loading/setup styles.

`src/pages/`:

- Top-level screens and their CSS modules.
- The app uses state tabs instead of URL routing.

`src/hooks/`:

- Firestore subscriptions and write helpers.
- Most business persistence enters through these hooks.

`src/components/`:

- Modals, forms, shared UI, premium UI, AI chat, auth UI, bottom nav, widgets.

`src/utils/`:

- Formatting, recurrence, exchange rates, AI prompt/context building, default config.

`src/i18n/`:

- Language setup and translation dictionaries.

## How to Add a New Feature Safely

1. Start from the domain type in `src/types.ts`.
2. Add or extend a Firestore hook in `src/hooks`.
3. Ensure Firestore documents include `userId` unless stored under `profiles/{uid}` or `userSettings/{uid}`.
4. Add UI in the relevant page/component using existing `Modal`, `Input`, `Select`, `NumberInput`, premium gates, and CSS Module patterns.
5. Add translation keys in `en`, `ru`, and `uz`.
6. Update all calculations that should include/exclude the new transaction source.
7. Run `npm run build`.

## High-Impact Files to Read First for Future Work

- App/auth/profile: `src/App.tsx`, `src/context.tsx`, `src/firebase.ts`.
- Domain model: `src/types.ts`.
- Transactions/balances: `src/pages/Transactions.tsx`, `src/components/AddTransactionModal.tsx`, `src/hooks/useTransactions.ts`, `src/hooks/useCards.ts`.
- Dashboard: `src/pages/Home.tsx`.
- Accounts/transfers: `src/pages/Accounts.tsx`, `src/pages/Cards.tsx`, `src/pages/Cash.tsx`.
- Calendar/planning: `src/pages/Calendar.tsx`, `src/components/PlannedExpenseModal.tsx`, `src/utils/recurrence.ts`.
- Premium: `src/hooks/useEntitlements.ts`, `src/components/PremiumLock.tsx`, `src/components/PremiumModal.tsx`.
- AI: `src/utils/ai.ts`, `src/utils/aiChat.ts`, `src/components/AskAIChat.tsx`.
- Settings: `src/pages/Settings.tsx`, `src/hooks/useUserSettings.ts`.
