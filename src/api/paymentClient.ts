import { auth } from '../firebase';

const PAYMENT_BASE = (import.meta.env.VITE_PAYMENT_API_BASE_URL?.trim() || '')
  .replace(/\/+$/, '');

export type PaymentPlanCode =
  | 'premium_1_month'
  | 'premium_3_months'
  | 'premium_6_months'
  | 'premium_12_months';

export interface PaymentPlan {
  code: PaymentPlanCode;
  name: string;
  durationMonths: number;
  amountMinor: number;
  currency: 'UZS';
}

export interface CheckoutSession {
  orderId: string;
  paymentId: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
  paymentStatus: string;
  amountMinor: number;
  currency: string;
  planCode: PaymentPlanCode;
  durationMonths: number;
  checkoutUrl?: string;
  createdAt: string;
  paidAt?: string;
  entitlementStartAt?: string;
  entitlementEndAt?: string;
}

export class PaymentApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'PaymentApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options?: { body?: unknown; idempotencyKey?: string; authenticated?: boolean },
): Promise<T> {
  if (!PAYMENT_BASE) throw new PaymentApiError(0, 'PAYMENT_NOT_CONFIGURED', 'Payment API is not configured.');
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
  };
  if (options?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (options?.authenticated !== false) {
    const user = auth.currentUser;
    if (!user) throw new PaymentApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(`${PAYMENT_BASE}${path}`, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) as unknown : undefined;
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new PaymentApiError(
      response.status,
      error?.code ?? 'PAYMENT_ERROR',
      error?.message ?? response.statusText,
    );
  }
  return data as T;
}

export const paymentApi = {
  async listPlans(language: 'ru' | 'uz' | 'en'): Promise<PaymentPlan[]> {
    const result = await request<{ plans: PaymentPlan[] }>(
      'GET',
      `/v1/plans?language=${language}`,
      { authenticated: false },
    );
    return result.plans;
  },

  createCheckout(
    planCode: PaymentPlanCode,
    language: 'ru' | 'uz' | 'en',
    channel: 'web' | 'telegram',
    idempotencyKey: string,
  ) {
    return request<CheckoutSession>('POST', '/v1/checkout-sessions', {
      body: { planCode, language, channel },
      idempotencyKey,
    });
  },

  refreshOrder(orderId: string) {
    return request<CheckoutSession>('POST', `/v1/orders/${encodeURIComponent(orderId)}/refresh-status`);
  },
};
