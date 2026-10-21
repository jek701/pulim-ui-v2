# pulim-ui-v2 — web client (deep reference)

Repo: `~/WebstormProjects/pulim-ui-v2` (git `jek701/pulim-ui-v2`, work directly on `main`).
Snapshot 2026-10-21, HEAD `7bd1f0f` (2026-10-17). Prod: `https://m-pulim.uz`, pm2 `pulim-ui-v2` on port 3000 in `/root/pulim-ui-v2`.
Related: [overview](overview.md), [pulim-api-v2 → docs/ai/api.md](../../../pulim-api-v2/docs/ai/api.md), [pulim-payment-api → docs/ai/payments.md](../../../pulim-payment-api/docs/ai/payments.md), [workflow](workflow.md).
`PROJECT_CONTEXT.md` in the repo is partly stale (Firestore era, Cards.tsx/Cash.tsx, fallback `ru`, Inter font) — the 2026-10-13 header in it is the correction.

## Modes
Telegram Mini App (primary), PWA, plain website. Mobile-first, `#root` max-width 430px.

## Stack
React 19.2, TS ~6, Vite 8, vite-plugin-pwa. **No URL router** — `activeTab` in context.
One big React Context `src/context.tsx` (~780 lines: auth, profile, tabs, filters, workspace, payment monitoring, deep links).
TanStack Query v5 (`src/api/queryClient.ts`, staleTime 30 s, retry 1, keys `qk.*` scoped by uid).
Firebase Auth JS v12 only (Firestore removed from UI 2026-10-13). CSS Modules + tokens in `src/global.css`, no UI kit.
react-icons/hi2, framer-motion (`MotionConfig reducedMotion="user"`), recharts 3, @dnd-kit, i18next (**uz, ru, en; default+fallback `uz`**),
dayjs, react-markdown (AI chat), modern-screenshot (dev notes only).

Commands: `npm run dev` (launch.json → port **5199** strict), `npm run build` (`tsc -b && vite build`), `npm run lint`, `npm run check:i18n`.
No unit test framework; ad-hoc `node scripts/check-swipe-dismiss.mjs`, `node scripts/check-calendar-days.mjs`.
Verification before commit: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/ && npm run check:i18n && npm run build`.
Authenticated screens can't be opened locally (need real auth) — rely on typecheck/build; login screen can be previewed.

## Env names (`.env`, gitignored)
VITE_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID, VITE_TELEGRAM_AUTH_API_URL,
VITE_API_BASE_URL (fallback: Telegram auth URL minus `/auth/telegram`), VITE_PAYMENT_API_BASE_URL, VITE_TELEGRAM_BOT_USERNAME,
VITE_COMMUNICATIONS_ENABLED (missing from .env.example). No AI/provider keys in frontend.

## Screens / tabs (`Tab` in `src/types.ts`, rendered by `App.tsx` PageContent)
Visible nav — personal: Home, History(`transactions`), Accounts(`cards`), Subscriptions, Settings; family: Home, History, Accounts, Settings.
- **Login**: phone +998 + 6-digit SMS (API sends via Eskiz) — main path; hidden legacy email/password; inside Telegram auto sign-in from initData. → **PhoneNameSetup** if no name.
- **Home**: configurable widgets (`profile.homeWidgets`, `utils/homeWidgets.ts`): balance (→ BalanceDetails ring), askAi, budget, forecast (+AI forecast), exchangeRates (CBU, off by default), recent (15 tx). FAB → AddTransactionModal → ReturnModal.
- **History** (`pages/Transactions.tsx`, ~1.2k lines): month/range, filters (kind, category, subcategory, account; advanced = Premium), list/pie/line, totals exclude transfers, refunds reduce expense, same-day refunds folded into purchase row; edit/delete, EditTransferModal, EditReturnModal, partial returns.
- **Accounts** (`pages/Accounts.tsx`): segments Accounts (debit/credit/cash, drag reorder → `/v1/settings.cardOrder`, hide balances, AccountSheet: transfer, credit refill, edit, delete, include-in-total, family access; card network guessed by `utils/cardNetwork.ts`), **Savings** (goals + shared family goals), **Debts** (I owe / owed to me, by person, partial pay, commission, due dates).
- **Subscriptions** (user's Netflix etc., not Premium): pay → expense tx + next date; auto-writes `__subscription__` budget; free max 2.
- **Settings** (~1.2k lines, sub-views): profile, Premium card, workspace switcher, Telegram reminders + bot reachability, quick-entry toggle, Messages (flag), iPhone Shortcut key (Premium), language, home widgets, categories/subcategories, budgets, Calendar entry, account/security, clear data.
- **Calendar** (Premium; via Settings or `?tab=calendar`): month grid, planned expenses/income (recurrence once/daily/weekly/weekdays/weekends/monthly/yearly/custom), projected balance.
- **Charts**: tab exists but no nav button (only `?tab=charts`).
- **AI chat** (`components/AskAIChat.tsx`): SSE streaming, multiple chats, feedback. Free: 10 msgs/30 days, 1 chat.
- **Family workspace** (`pages/HouseholdSpace.tsx`, max 2 members): FamilyHome, FamilyTransactions, FamilyAccounts (common accounts + partner-shared personal cards + shared goals), FamilySettings; invites via Telegram `shareMessage` / t.me/share / navigator.share / copy. Workspace in localStorage `pulim.workspace`.
- Overlays: TelegramLinkBanner, NotificationEnableBanner, PaymentResultModal, CommunicationSurface, PremiumModal, DevNotesRoot (owner only).
- **Implemented but unreachable**: `pages/Deposits.tsx`, `pages/Onboarding.tsx`, `AuthUpgradeModal` (phone-link flow — not wired anywhere!), AnimatedAmount, Category.tsx, priceFormatter.

## Deep links / query params
`?tab=` (debts/savings → cards segment), `?tx=<id>` or start_param `tx_<id>`, `?upgrade=1`, `?auth=telegram|link`, `?lang=`,
`?familyInvite=<token>` or `family_<token>`, `?order=&state=` (old ATMOS return → bounce to payment API), `?payment=&order=` or `payment_<uuid>`, `?section=budgets`.

## API layer
`src/api/client.ts` (fetch wrapper, `ApiError(status, code, message, details)`, Bearer Firebase ID token + `ngrok-skip-browser-warning`), `paymentClient.ts`, `phoneAuth.ts`.
One hook per domain in `src/hooks/` (useTransactions, useCards, useCategories, useBudgets, useSubscriptions, usePlannedExpenses, useDebts, useDeposits, useSavingsGoals, useAiChats, useHousehold, useUserSettings, useNotificationSettings, useShortcutToken, useCommunications, useCommunicationAdmin, useDevNotes, useEntitlements).
Auth flows: Telegram `POST VITE_TELEGRAM_AUTH_API_URL {telegramInitData, chatId, language?}` → customToken → `signInWithCustomToken`;
phone `POST /auth/phone/send-code` + `/auth/phone/verify` (purpose signin|link); then `POST /v1/profile/bootstrap` + `GET /v1/profile`.
Endpoint list: see [pulim-api-v2 → docs/ai/api.md](../../../pulim-api-v2/docs/ai/api.md).

## Premium in UI
`hooks/useEntitlements.ts`: premium = `profile.isPremium && subscription.premiumUntil > now` (re-evaluated each minute); source trial|atmos|none.
`FREE_LIMITS`: 1 account (debit only), 2 subscriptions, 10 AI msgs/month, 1 AI chat. Premium-only: credit/cash accounts, custom categories, budgets, debts, savings, deposits, planned/calendar, charts, advanced filters, extra AI chats, Shortcut, Telegram quick entry. **Server is authoritative.**
Paywall components in `PremiumLock` (Badge, Banner, Wall, `usePremiumGate()`). `PremiumModal`: plans from payment API, 7-day trial (`POST /v1/profile/trial/start`), checkout → ATMOS. Payment monitoring in context (localStorage `pulim:pending-payment:<uid>`, poll every 5 s ≤30 min, then poll `/v1/profile?billingRefresh=` ≤12×1.5 s). Full flow: [pulim-payment-api → docs/ai/payments.md](../../../pulim-payment-api/docs/ai/payments.md).

## Telegram Mini App
`index.html` loads telegram-web-app.js; `utils/telegram.ts` treats SDK live only if initData or platform≠unknown; `tgAtLeast(version)` guards calls.
`main.tsx`: ready, expand, requestFullscreen (8.0+), theme follows Telegram colorScheme / OS (`data-theme` on html; **no manual toggle**), header colors `#161618`/`#F2F2F7`,
viewport vars `--app-height` etc., safe-area vars `--tg-safe-*-js`, `:root[data-tg-fullscreen]` reserves 52px.
Uses showConfirm, HapticFeedback, disable/enableVerticalSwipes, openTelegramLink, openLink (checkout), shareMessage. NOT used: BackButton, MainButton, CloudStorage, openInvoice.

## Design system ("Apple UI" direction, plans/2026-10-16-*)
Dark default bg `#111113`, surfaces `#1C1C1E/#2C2C2E/#3A3A3C`, **accent purple `#7C3AED`**, income `#30D158`, expense `#FF453A`; light theme `:root[data-theme="light"]` bg `#F2F2F7`.
Radii 16/12/24/20, type 24/17/15/12, system font. Floating glass bottom nav. Bottom-sheet `components/Modal.tsx` + `useSwipeDismiss` (72px threshold), `useModalClose` (240 ms, `beforeClose`, draft-loss guard), `useDialogFocus`.
"Plastic" card style only in account/goal details (`components/plastic/`); lists are compact iOS-style rows. One shared `AccountPicker`, `EmptyState`.

## Financial display rules (must preserve)
- Use `getTransactionKind` (`utils/transactionKind.ts`). Transfer = `type:'expense'` + `source:'transfer'` → excluded from totals. Return = `type:'income'` + `source:'return'` → **reduces expense**, never income, keeps original categoryId.
- Credit card `balance` = used debt; available = limit − balance. `includeInTotalBalance` only for debit/cash.
- Non-UZS tx carry `baseAmount`, `fxRate`, `fxRateSource` (NBU|manual); summaries skip unconverted and flag `hasUnconverted`. Rates from cbu.uz (`utils/nbuRates.ts`).
- Household-scope tx (`scope:'household'`) excluded from personal analytics. `origin:'telegram'` (bot entry) ≠ `source`.
- All balance changes are atomic **server** endpoints — client never adjusts balances.
- Amount max 999 999 999 999 (`utils/money.ts`). New strings → all 3 locales + `npm run check:i18n`.

## Communications (feature-flagged)
`src/communications/*`, hidden unless `VITE_COMMUNICATIONS_ENABLED=true`. Inbox (polled 60 s), banner/modal surfaces, preferences, owner-only CampaignAdmin. Spec: `docs/communications-mvp.md` (campaigns RU/UZ/EN, in-app + opt-in Telegram, targeting by tier/lang/telegram-linked; states draft→scheduled→sending→paused/completed/failed). Copy is hard-coded Russian (not i18n).

## Dev notes widget
`src/devNotes/` — lightbulb button for the owner only (`/v1/dev-notes/access`), element picker + screenshot + CSS-module selector. Processing: [workflow](workflow.md).

## Known bugs / gotchas (as of 2026-10-21)
- `Home.tsx:163` forecast language: `ru` else `uz` → English users get Uzbek forecast.
- PaymentResultModal formats dates `uz-UZ` for Russian; `Calendar.DAY_HEADERS` only ru/en; PlannedExpenseModal hard-coded "Icon".
- Local working tree has `public/pulim-expense.shortcut` deleted (uncommitted) — committing it breaks Shortcut install (`SHORTCUT_INSTALL_URL`).
- No pagination (API returns full lists); AI chats store messages as array in one doc; Settings/Transactions/AddTransactionModal are huge.
- Audit fixes from 2026-10-15/16 plans not fully verified on a real Telegram device.
- Package name still "vite-project"; README half Vite template.
- Storage keys: localStorage `lang`, `pulim.workspace`, `pulim.hideAccountBalances`, `nbuRatesCache_v1`, `pulim:pending-payment:<uid>`, `pulim:payment-modal-dismissed:*`, `devNotes.*`; sessionStorage `pulim.familyInviteHandled`.
