import { api } from './client';

/**
 * Phone sign-in endpoints. The API sends the code through the Eskiz SMS gateway
 * and returns a Firebase custom token once the code checks out, so there is no
 * reCAPTCHA and no Firebase phone provider involved on this side.
 */

export type PhoneAuthPurpose = 'signin' | 'link';

export interface SendPhoneCodeResponse {
  success: true;
  phone: string;
  /** Code lifetime in seconds. */
  expiresIn: number;
  /** Seconds to wait before a resend is accepted. */
  resendAfter: number;
  requestId: string | null;
  /** Only present when the API runs with PHONE_AUTH_DEBUG_ECHO_CODE (dev). */
  debugCode?: string;
}

export interface VerifyPhoneCodeResponse {
  success: true;
  uid: string;
  isNewUser: boolean;
  /** Present for `signin`; absent for `link`, which keeps the current session. */
  customToken?: string;
  linked?: boolean;
}

export const sendPhoneCode = (input: {
  phone: string;
  purpose: PhoneAuthPurpose;
  language?: string;
  firebaseIdToken?: string;
}) => api.post<SendPhoneCodeResponse>('/auth/phone/send-code', input);

export const verifyPhoneCode = (input: {
  phone: string;
  code: string;
  purpose: PhoneAuthPurpose;
  firebaseIdToken?: string;
}) => api.post<VerifyPhoneCodeResponse>('/auth/phone/verify', input);
