import type {Category, Transaction, TransactionType} from '../types';

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
