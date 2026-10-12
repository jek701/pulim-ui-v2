import type {Category, Currency, Transaction, TransactionType} from '../types';

const DEFAULT_AMOUNTS: Record<Currency, number[]> = {
    UZS: [10_000, 50_000, 100_000, 500_000],
    USD: [10, 20, 50, 100],
    EUR: [10, 20, 50, 100],
    RUB: [500, 1_000, 5_000, 10_000],
    GBP: [10, 20, 50, 100],
    CNY: [10, 50, 100, 500],
    KZT: [1_000, 5_000, 10_000, 20_000],
    TRY: [50, 100, 500, 1_000],
    AED: [10, 50, 100, 500],
    JPY: [500, 1_000, 5_000, 10_000],
};

/**
 * Put the categories a user reaches for most often first without changing the
 * stored category order. Recency only breaks ties, so one new transaction does
 * not outweigh a genuinely frequent category.
 */
export function rankCategoriesByUsage(
    categories: Category[],
    transactions: Transaction[],
    type: TransactionType,
): Category[] {
    const usage = new Map<string, {count: number; lastUsed: number}>();

    for (const transaction of transactions) {
        if (transaction.type !== type || transaction.source === 'transfer' || transaction.source === 'return') continue;
        const current = usage.get(transaction.categoryId) ?? {count: 0, lastUsed: 0};
        usage.set(transaction.categoryId, {
            count: current.count + 1,
            lastUsed: Math.max(current.lastUsed, transaction.date),
        });
    }

    return categories
        .map((category, index) => ({category, index, usage: usage.get(category.id)}))
        .sort((left, right) => (
            (right.usage?.count ?? 0) - (left.usage?.count ?? 0)
            || (right.usage?.lastUsed ?? 0) - (left.usage?.lastUsed ?? 0)
            || left.index - right.index
        ))
        .map(item => item.category);
}

/**
 * Suggest category-specific amounts when history exists and fill any remaining
 * slots with useful defaults for the selected currency.
 */
export function suggestTransactionAmounts(
    transactions: Transaction[],
    type: TransactionType,
    currency: Currency,
    categoryId: string,
    limit = 5,
): number[] {
    const usage = new Map<number, {count: number; lastUsed: number}>();

    if (categoryId) {
        for (const transaction of transactions) {
            if (
                transaction.type !== type
                || transaction.currency !== currency
                || transaction.categoryId !== categoryId
                || transaction.source === 'transfer'
                || transaction.source === 'return'
                || !Number.isFinite(transaction.amount)
                || transaction.amount <= 0
            ) continue;

            const current = usage.get(transaction.amount) ?? {count: 0, lastUsed: 0};
            usage.set(transaction.amount, {
                count: current.count + 1,
                lastUsed: Math.max(current.lastUsed, transaction.date),
            });
        }
    }

    const frequent = [...usage.entries()]
        .sort((left, right) => right[1].count - left[1].count || right[1].lastUsed - left[1].lastUsed)
        .map(([amount]) => amount);
    const combined = [...frequent, ...DEFAULT_AMOUNTS[currency]];

    return combined.filter((amount, index) => combined.indexOf(amount) === index).slice(0, limit);
}
