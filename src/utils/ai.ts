import { api } from '../api/client';

/**
 * Month-end budget forecast. The server assembles all the data (current-month +
 * 90-day history, budgets, profile, subscriptions, planned items) and runs the model.
 */
export async function getBudgetForecast(language: string): Promise<string> {
  const res = await api.post<{ text: string }>('/v1/ai/forecast', { language });
  return res.text;
}
