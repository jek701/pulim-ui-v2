import { useEffect, useId, useRef, useState } from 'react';
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import {
  HiArrowPath,
  HiDevicePhoneMobile,
  HiEnvelope,
  HiLockClosed,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import { auth } from '../firebase';
import { ApiError } from '../api/client';
import { sendPhoneCode, verifyPhoneCode } from '../api/phoneAuth';
import { useApp } from '../context';
import styles from './AuthMethodsPanel.module.css';

interface Props {
  mode: 'signin' | 'link';
  onSuccess?: () => void;
  externalError?: string | null;
  showLegacyEmail?: boolean;
}

const formatPhoneInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (raw.trimStart().startsWith('+') && !digits.startsWith('998')) {
    return `+${digits.slice(0, 15)}`;
  }

  const national = (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
  const parts = [
    national.slice(0, 2),
    national.slice(2, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ].filter(Boolean);

  return parts.length > 0 ? `+998 ${parts.join(' ')}` : '+998 ';
};

const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const e164 = `+${digits}`;
  return {
    e164,
    // Eskiz sends domestic SMS only, so the gateway accepts +998 numbers exclusively.
    valid: /^\+998\d{9}$/.test(e164),
  };
};

const smsLanguage = (language: string) => {
  const base = language.split('-')[0];
  return base === 'ru' || base === 'en' || base === 'uz' ? base : 'uz';
};

const AuthMethodsPanel: React.FC<Props> = ({
  mode,
  onSuccess,
  externalError,
  showLegacyEmail = false,
}) => {
  const { t, i18n } = useTranslation();
  const { reloadUser } = useApp();
  const idPrefix = useId().replace(/:/g, '_');
  const sendButtonId = `phone_send_${idPrefix}`;
  const phoneFormId = `phone_form_${idPrefix}`;
  const sendCodeInFlightRef = useRef(false);
  const [busyMethod, setBusyMethod] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+998 ');
  const [smsCode, setSmsCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const [legacyEmail, setLegacyEmail] = useState('');
  const [legacyPassword, setLegacyPassword] = useState('');

  // Resend cooldown mirrors the server-side one, so the button reflects reality
  // instead of letting the user collect 429s.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const mapPhoneError = (err: unknown) => {
    if (err instanceof TypeError) return t('login.err_network');
    if (!(err instanceof ApiError)) {
      const message = (err as { message?: string }).message;
      return message || t('common.error_generic');
    }
    const details = (err.details ?? {}) as { retryAfter?: number; attemptsLeft?: number };
    switch (err.code) {
      case 'PHONE_INVALID':
      case 'VALIDATION_ERROR':
        return t('auth.err_invalid_phone');
      case 'RESEND_TOO_SOON':
        return t('auth.err_resend_too_soon', { seconds: details.retryAfter ?? 60 });
      case 'TOO_MANY_SENDS':
        return t('auth.err_too_many_sends');
      case 'CODE_INVALID':
        return details.attemptsLeft
          ? t('auth.err_invalid_code_attempts', { attempts: details.attemptsLeft })
          : t('auth.err_invalid_code');
      case 'CODE_EXPIRED':
        return t('auth.err_code_expired');
      case 'CODE_NOT_FOUND':
        return t('auth.err_code_not_found');
      case 'TOO_MANY_ATTEMPTS':
        return t('auth.err_too_many_attempts');
      case 'PHONE_ALREADY_LINKED':
        return t('auth.err_credential_in_use');
      case 'SMS_UNAVAILABLE':
        return t('auth.err_sms_unavailable');
      case 'SMS_SEND_FAILED':
      case 'SMS_GATEWAY_ERROR':
        return t('auth.err_sms_failed');
      case 'RATE_LIMITED':
        return t('login.err_too_many_attempts');
      case 'AUTH_REQUIRED':
        return mode === 'link' ? t('auth.err_no_user') : t('common.error_generic');
      default:
        return err.message || t('common.error_generic');
    }
  };

  const mapEmailError = (err: unknown) => {
    const code = (err as { code?: string }).code?.replace('auth/', '') ?? '';
    const message = (err as { message?: string }).message ?? '';
    const errors: Record<string, string> = {
      'too-many-requests': t('login.err_too_many_attempts'),
      'network-request-failed': t('login.err_network'),
      'operation-not-allowed': t('login.err_not_enabled'),
      'user-not-found': t('login.err_user_not_found'),
      'wrong-password': t('login.err_wrong_password'),
      'invalid-credential': t('login.err_invalid_credentials'),
    };
    return errors[code] ?? (message || t('common.error_generic'));
  };

  const resetPhoneFlow = () => {
    setCodeSentTo(null);
    setSmsCode('');
    setError('');
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendCodeInFlightRef.current || resendIn > 0) return;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone.valid) {
      setError(t('auth.err_invalid_phone'));
      return;
    }

    sendCodeInFlightRef.current = true;
    setBusyMethod('phone-send');
    setError('');
    try {
      if (mode === 'link' && !auth.currentUser) throw new Error(t('auth.err_no_user'));
      const result = await sendPhoneCode({
        phone: normalizedPhone.e164,
        purpose: mode === 'link' ? 'link' : 'signin',
        language: smsLanguage(i18n.resolvedLanguage ?? i18n.language),
        firebaseIdToken: mode === 'link' ? await auth.currentUser!.getIdToken() : undefined,
      });
      setCodeSentTo(result.phone);
      setResendIn(result.resendAfter);
      // Dev convenience: the API only echoes the code when SMS sending is disabled.
      if (result.debugCode) setSmsCode(result.debugCode);
    } catch (err) {
      console.error(`[auth:${mode === 'link' ? 'link-' : ''}phone-send]`, err);
      setError(mapPhoneError(err));
    } finally {
      sendCodeInFlightRef.current = false;
      setBusyMethod(null);
    }
  };

  const handleConfirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!codeSentTo) return;

    setBusyMethod('phone-confirm');
    setError('');
    try {
      const result = await verifyPhoneCode({
        phone: codeSentTo,
        code: smsCode,
        purpose: mode === 'link' ? 'link' : 'signin',
        firebaseIdToken: mode === 'link' ? await auth.currentUser?.getIdToken() : undefined,
      });
      if (result.customToken) await signInWithCustomToken(auth, result.customToken);
      if (mode === 'link') await reloadUser();
      onSuccess?.();
    } catch (err) {
      console.error(`[auth:${mode === 'link' ? 'link-' : ''}phone-confirm]`, err);
      setError(mapPhoneError(err));
    } finally {
      setBusyMethod(null);
    }
  };

  const handleLegacyEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyMethod('legacy-email');
    setError('');
    try {
      await signInWithEmailAndPassword(auth, legacyEmail.trim(), legacyPassword);
      onSuccess?.();
    } catch (err) {
      console.error('[auth:legacy-email]', err);
      setError(mapEmailError(err));
    } finally {
      setBusyMethod(null);
    }
  };

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const codeComplete = /^\d{6}$/.test(smsCode);
  const phoneBusy = busyMethod === 'phone-send' || busyMethod === 'phone-confirm';

  const sendButtonLabel = () => {
    if (busyMethod === 'phone-send') return t('auth.phone_sending');
    if (resendIn > 0) return t('auth.phone_resend_in', { seconds: resendIn });
    return codeSentTo ? t('auth.phone_resend_code') : t('auth.phone_send_code');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.phoneFlow}>
        <div className={styles.phoneIntro}>
          <span className={styles.phoneIcon}>
            <HiDevicePhoneMobile size={20} />
          </span>
          <div>
            <p className={styles.phoneTitle}>
              {mode === 'link' ? t('auth.link_phone') : t('auth.phone_primary_title')}
            </p>
            <p className={styles.phoneSubtitle}>
              {mode === 'link' ? t('auth.phone_link_subtitle') : t('auth.phone_primary_subtitle')}
            </p>
          </div>
        </div>

        <form id={phoneFormId} className={styles.phoneForm} onSubmit={handleSendCode}>
          <label className={styles.fieldLabel} htmlFor={`${sendButtonId}_number`}>
            {t('auth.phone_label')}
          </label>
          <div className={styles.field}>
            <HiDevicePhoneMobile size={17} className={styles.fieldIcon} />
            <input
              id={`${sendButtonId}_number`}
              className={styles.input}
              type="tel"
              placeholder={t('auth.phone_placeholder')}
              value={phoneNumber}
              onChange={(event) => {
                setPhoneNumber(formatPhoneInput(event.target.value));
                if (codeSentTo) resetPhoneFlow();
              }}
              autoComplete="tel"
              inputMode="tel"
              disabled={phoneBusy}
              aria-invalid={Boolean(error)}
            />
          </div>
          <button
            id={sendButtonId}
            className={styles.primaryBtn}
            disabled={!normalizedPhone.valid || phoneBusy || resendIn > 0}
            type="submit"
          >
            {sendButtonLabel()}
          </button>
          <p className={styles.smsNote}>{t('auth.phone_sms_note')}</p>
        </form>

        {codeSentTo && (
          <form className={styles.codeForm} onSubmit={handleConfirmCode}>
            <div className={styles.sentNotice}>
              <HiOutlineCheckCircle size={18} />
              <span>{t('auth.phone_code_sent', { phone: codeSentTo })}</span>
            </div>
            <label className={styles.fieldLabel} htmlFor={`${sendButtonId}_code`}>
              {t('auth.phone_code_label')}
            </label>
            <input
              id={`${sendButtonId}_code`}
              className={`${styles.input} ${styles.codeInput}`}
              type="text"
              placeholder={t('auth.phone_code_placeholder')}
              value={smsCode}
              onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              disabled={phoneBusy}
            />
            <button className={styles.primaryBtn} disabled={!codeComplete || phoneBusy} type="submit">
              {busyMethod === 'phone-confirm' ? t('auth.phone_confirming') : t('auth.phone_confirm_code')}
            </button>
            <button className={styles.secondaryBtn} onClick={resetPhoneFlow} disabled={phoneBusy} type="button">
              <HiArrowPath size={15} />
              {t('auth.phone_reset')}
            </button>
          </form>
        )}
      </div>

      {showLegacyEmail && mode === 'signin' && (
        <div className={styles.legacy}>
          <div className={styles.divider}>
            <span>{t('auth.legacy_divider')}</span>
          </div>
          <button
            className={styles.legacyToggle}
            onClick={() => {
              setShowLegacyForm((value) => !value);
              setError('');
            }}
            type="button"
            aria-expanded={showLegacyForm}
          >
            <HiEnvelope size={16} />
            <span>{t('auth.legacy_email_toggle')}</span>
          </button>

          {showLegacyForm && (
            <form className={styles.legacyForm} onSubmit={handleLegacyEmail}>
              <p className={styles.legacyHint}>{t('auth.legacy_email_hint')}</p>
              <div className={styles.field}>
                <HiEnvelope size={16} className={styles.fieldIcon} />
                <input
                  className={styles.input}
                  type="email"
                  placeholder={t('login.email')}
                  value={legacyEmail}
                  onChange={(event) => setLegacyEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className={styles.field}>
                <HiLockClosed size={16} className={styles.fieldIcon} />
                <input
                  className={styles.input}
                  type="password"
                  placeholder={t('login.password')}
                  value={legacyPassword}
                  onChange={(event) => setLegacyPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                className={styles.primaryBtn}
                type="submit"
                disabled={!legacyEmail.trim() || !legacyPassword || busyMethod !== null}
              >
                {busyMethod === 'legacy-email' ? t('auth.legacy_email_signing_in') : t('auth.legacy_email_submit')}
              </button>
            </form>
          )}
        </div>
      )}

      {(error || externalError) && (
        <p className={styles.error} role="alert">{error || externalError}</p>
      )}
    </div>
  );
};

export default AuthMethodsPanel;
