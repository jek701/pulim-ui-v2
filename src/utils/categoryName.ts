import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CategoryType } from '../types';
import { DEFAULT_CATEGORIES } from './defaultCategories';

/** Seeded category name → `settings.default_category_*` suffix. */
const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
  Salary: 'salary',
  Freelance: 'freelance',
  Investments: 'investments',
  Gift: 'gift',
  Business: 'business',
  'Other Income': 'other_income',
  Food: 'food',
  Transport: 'transport',
  Shopping: 'shopping',
  Bills: 'bills',
  Entertainment: 'entertainment',
  Health: 'health',
  Education: 'education',
  Housing: 'housing',
  Travel: 'travel',
  Beauty: 'beauty',
  Other: 'other',
};

export type NamedCategory = { name: string; icon: string; type: CategoryType };

/**
 * Default categories are seeded server-side with English names, so they cannot be
 * translated from the document alone — match them by (name, icon, type) and swap in
 * the locale string. User-created categories keep whatever the user typed.
 */
export const isDefaultCategory = (category: NamedCategory): boolean =>
  DEFAULT_CATEGORIES.some(
    defaultCategory =>
      defaultCategory.name === category.name
      && defaultCategory.icon === category.icon
      && defaultCategory.type === category.type,
  );

export const categoryDisplayName = (category: NamedCategory, t: TFunction): string => {
  if (!isDefaultCategory(category)) return category.name;
  const key = DEFAULT_CATEGORY_KEYS[category.name];
  return key ? t(`settings.default_category_${key}`) : category.name;
};

/** Hook form for components that already have no `t` in scope. */
export const useCategoryName = () => {
  const { t } = useTranslation();
  return (category: NamedCategory | undefined | null): string =>
    category ? categoryDisplayName(category, t) : '';
};
