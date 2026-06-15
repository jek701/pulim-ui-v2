import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Currency } from '../types';

// ── Raw CSV rows (Apr 1–10, 2026) ──────────────────────────
// Skipped: transfers (перемещение), Кредит expense (→ debt),
//          Наличные wallet, я дал/я взял (→ debts)

interface RawTx {
  date: string;
  type: 'income' | 'expense';
  catName: string;
  sub?: string;
  amount: number;
  currency: Currency;
  cardSlot: 'debit' | 'credit';
  comment?: string;
}

const RAW_TRANSACTIONS: RawTx[] = [
  // Apr 10
  { date: '2026-04-10', type: 'expense', catName: 'Bills',         sub: 'Podpiska',  amount: 365000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-10', type: 'expense', catName: 'Housing',       sub: '❤️',        amount: 600000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-10', type: 'expense', catName: 'Transport',                        amount: 13000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-10', type: 'expense', catName: 'Food',                             amount: 93000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-10', type: 'expense', catName: 'Food',                             amount: 300000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-10', type: 'income',  catName: 'Salary',                           amount: 3900000, currency: 'UZS', cardSlot: 'debit' },
  // Apr 8
  { date: '2026-04-08', type: 'expense', catName: 'Food',                             amount: 42500,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-08', type: 'expense', catName: 'Housing',                          amount: 12300,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-08', type: 'expense', catName: 'Food',                             amount: 35000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-08', type: 'expense', catName: 'Bills',         sub: 'Svet',       amount: 50000,   currency: 'UZS', cardSlot: 'debit' },
  // Apr 7
  { date: '2026-04-07', type: 'expense', catName: 'Food',                             amount: 58000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-07', type: 'expense', catName: 'Food',          sub: 'Uyga',       amount: 42500,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-07', type: 'expense', catName: 'Health',                           amount: 27000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-07', type: 'expense', catName: 'Food',                             amount: 105000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-07', type: 'expense', catName: 'Food',          sub: 'Uyga',       amount: 14000,   currency: 'UZS', cardSlot: 'debit' },
  // Apr 6
  { date: '2026-04-06', type: 'expense', catName: 'Food',                             amount: 52000,   currency: 'UZS', cardSlot: 'debit' },
  // Apr 5
  { date: '2026-04-05', type: 'expense', catName: 'Food',          sub: 'Uyga',       amount: 20000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-05', type: 'expense', catName: 'Transport',                        amount: 43000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-05', type: 'expense', catName: 'Other',                            amount: 60000,   currency: 'UZS', cardSlot: 'debit',  comment: 'Diyora uyiga' },
  { date: '2026-04-05', type: 'expense', catName: 'Food',                             amount: 35000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-05', type: 'expense', catName: 'Other',                            amount: 165000,  currency: 'UZS', cardSlot: 'debit',  comment: 'Diyora uyiga' },
  { date: '2026-04-05', type: 'expense', catName: 'Entertainment', sub: 'Комп',       amount: 87000,   currency: 'UZS', cardSlot: 'debit' },
  // Apr 4
  { date: '2026-04-04', type: 'expense', catName: 'Food',                             amount: 100000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-04', type: 'expense', catName: 'Bills',                            amount: 70000,   currency: 'UZS', cardSlot: 'debit',  comment: 'Nomer Diyoraga' },
  { date: '2026-04-04', type: 'expense', catName: 'Shopping',                         amount: 312000,  currency: 'UZS', cardSlot: 'debit',  comment: 'Cargo' },
  { date: '2026-04-04', type: 'expense', catName: 'Food',                             amount: 28000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-04', type: 'expense', catName: 'Other',                            amount: 425000,  currency: 'UZS', cardSlot: 'debit',  comment: 'Pasport' },
  // Apr 3
  { date: '2026-04-03', type: 'expense', catName: 'Housing',                          amount: 22000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-03', type: 'expense', catName: 'Transport',                        amount: 21600,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-03', type: 'expense', catName: 'Food',                             amount: 80000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-03', type: 'expense', catName: 'Entertainment',                    amount: 60000,   currency: 'UZS', cardSlot: 'debit',  comment: 'Aylanish' },
  { date: '2026-04-03', type: 'expense', catName: 'Housing',                          amount: 261000,  currency: 'UZS', cardSlot: 'debit' },
  // Apr 2
  { date: '2026-04-02', type: 'expense', catName: 'Food',                             amount: 35000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-02', type: 'expense', catName: 'Housing',                          amount: 160000,  currency: 'UZS', cardSlot: 'debit',  comment: 'Suvga' },
  // Apr 1
  { date: '2026-04-01', type: 'expense', catName: 'Housing',                          amount: 50000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'expense', catName: 'Food',                             amount: 150000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'expense', catName: 'Housing',       sub: 'Sardorga',   amount: 20000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'expense', catName: 'Food',          sub: 'Uyga',       amount: 20000,   currency: 'UZS', cardSlot: 'credit' }, // TBC Kreditka
  { date: '2026-04-01', type: 'expense', catName: 'Housing',       sub: 'Onamga',     amount: 100000,  currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'income',  catName: 'Other Income',                     amount: 70000,   currency: 'UZS', cardSlot: 'debit',  comment: 'Cashback' },
  { date: '2026-04-01', type: 'expense', catName: 'Food',                             amount: 90000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'expense', catName: 'Transport',     sub: 'Tok',        amount: 50000,   currency: 'UZS', cardSlot: 'debit' },
  { date: '2026-04-01', type: 'expense', catName: 'Housing',       sub: 'Onamga',     amount: 80000,   currency: 'UZS', cardSlot: 'debit' },
];

// ── Debts ─────────────────────────────────────────────────────
const RAW_DEBTS = [
  {
    direction: 'i_owe', person: 'Аркаша iPhone',
    amount: 550, currency: 'USD' as Currency,
    comment: 'iPhone. Partial paid 1,215,000 UZS on Apr 10',
  },
  {
    direction: 'owe_me', person: 'Аркаша',
    amount: 3000000, currency: 'UZS' as Currency,
  },
  {
    direction: 'owe_me', person: 'Uzum Bank',
    amount: 4200000, currency: 'UZS' as Currency,
  },
  {
    direction: 'i_owe', person: 'Bank Credit',
    amount: 5155000, currency: 'UZS' as Currency,
    comment: 'Monthly installment. Edit to set actual remaining balance.',
  },
];

// ── Main export ───────────────────────────────────────────────
export async function runImport(userId: string): Promise<{ txCount: number; debtCount: number }> {
  // 1. Fetch categories
  const catSnap = await getDocs(query(collection(db, 'categories'), where('userId', '==', userId)));
  const catMap = new Map<string, string>(); // name → id
  catSnap.docs.forEach(d => catMap.set((d.data() as { name: string }).name, d.id));
  const fallbackCatId = catMap.get('Other') ?? '';

  // 2. Fetch cards
  const cardSnap = await getDocs(query(collection(db, 'cards'), where('userId', '==', userId)));
  let debitCardId = '';
  let creditCardId = '';
  cardSnap.docs.forEach(d => {
    const data = d.data() as { cardType: string };
    if (data.cardType === 'debit'  && !debitCardId)  debitCardId  = d.id;
    if (data.cardType === 'credit' && !creditCardId) creditCardId = d.id;
  });

  // 3. Fetch existing subcategories
  const subSnap = await getDocs(query(collection(db, 'subcategories'), where('userId', '==', userId)));
  // key: `${categoryId}::${name}` → subcategoryId
  const subMap = new Map<string, string>();
  subSnap.docs.forEach(d => {
    const data = d.data() as { categoryId: string; name: string };
    subMap.set(`${data.categoryId}::${data.name}`, d.id);
  });

  // helper: get or create subcategory
  const getOrCreateSub = async (categoryId: string, name: string): Promise<string> => {
    const key = `${categoryId}::${name}`;
    if (subMap.has(key)) return subMap.get(key)!;
    const ref = await addDoc(collection(db, 'subcategories'), { name, categoryId, userId, createdAt: Date.now() });
    subMap.set(key, ref.id);
    return ref.id;
  };

  // 4. Add transactions
  let txCount = 0;
  for (const tx of RAW_TRANSACTIONS) {
    const categoryId = catMap.get(tx.catName) ?? fallbackCatId;
    if (!categoryId) continue;

    const cardId = tx.cardSlot === 'debit' ? debitCardId : creditCardId;
    const doc: Record<string, unknown> = {
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      categoryId,
      date: new Date(tx.date).getTime(),
      userId,
      createdAt: Date.now() + txCount,
    };

    if (tx.sub) {
      doc.subcategoryId = await getOrCreateSub(categoryId, tx.sub);
    }
    if (tx.comment) doc.comment = tx.comment;
    if (cardId)     doc.cardId  = cardId;

    await addDoc(collection(db, 'transactions'), doc);
    txCount++;
  }

  // 5. Add debts
  let debtCount = 0;
  for (const debt of RAW_DEBTS) {
    const doc: Record<string, unknown> = {
      direction: debt.direction,
      person: debt.person,
      amount: debt.amount,
      currency: debt.currency,
      isPaid: false,
      userId,
      createdAt: Date.now() + debtCount,
    };
    if (debt.comment) doc.comment = debt.comment;
    await addDoc(collection(db, 'debts'), doc);
    debtCount++;
  }

  return { txCount, debtCount };
}
