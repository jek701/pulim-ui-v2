import { api } from '../api/client';

export interface BudgetForecast {
  summary: string;
  predictions: string[];
  action: string;
  confidence: 'low' | 'medium' | 'high';
  generatedAt: number;
}

/**
 * Month-end budget forecast. The server assembles all the data (current-month +
 * one-year history, budgets, profile, subscriptions, planned items) and runs the model.
 */
export async function getBudgetForecast(language: 'en' | 'ru' | 'uz'): Promise<BudgetForecast> {
  return api.post<BudgetForecast>('/v1/ai/forecast', { language });
}
