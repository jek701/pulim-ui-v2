import { useEffect, useId, useRef, useState } from 'react';
import {
  linkWithPhoneNumber,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
} from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import {
  HiArrowPath,
  HiDevicePhoneMobile,
  HiEnvelope,
  HiLockClosed,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';
import { auth, firebaseProjectId } from '../firebase';
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
    valid: /^\+[1-9]\d{7,14}$/.test(e164),
  };
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
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const sendCodeInFlightRef = useRef(false);
  const [busyMethod, setBusyMethod] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+998 ');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const [legacyEmail, setLegacyEmail] = useState('');
  const [legacyPassword, setLegacyPassword] = useState('');

  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  const mapAuthError = (err: unknown, method: 'phone' | 'email') => {
    const code = (err as { code?: string }).code?.replace('auth/', '') ?? '';
    const message = (err as { message?: string }).message ?? '';
    if (
      method === 'phone'
      && (code === 'error-code:-39' || /error code:\s*39\b/i.test(message))
    ) {
      return t('auth.err_sms_temporarily_blocked');
    }
    const sharedErrors: Record<string, string> = {
      'too-many-requests': t('login.err_too_many_attempts'),
      'network-request-failed': t('login.err_network'),
      'operation-not-supported-in-this-environment': t('auth.err_environment'),
    };
    const phoneErrors: Record<string, string> = {
      'operation-not-allowed': t('auth.err_phone_unavailable', {
        projectId: firebaseProjectId,
      }),
      'invalid-phone-number': t('auth.err_invalid_phone'),
      'missing-phone-number': t('auth.err_invalid_phone'),
      'invalid-verification-code': t('auth.err_invalid_code'),
      'missing-verification-code': t('auth.err_invalid_code'),
      'code-expired': t('auth.err_code_expired'),
      'session-expired': t('auth.err_code_expired'),
      'captcha-check-failed': t('auth.err_recaptcha'),
      'app-not-authorized': t('auth.err_phone_domain'),
      'unauthorized-domain': t('auth.err_phone_domain'),
      'invalid-app-credential': t('auth.err_phone_domain'),
      'credential-already-in-use': t('auth.err_credential_in_use'),
      'provider-already-linked': t('auth.err_provider_linked'),
    };
    const emailErrors: Record<string, string> = {
      'operation-not-allowed': t('login.err_not_enabled'),
      'user-not-found': t('login.err_user_not_found'),
      'wrong-password': t('login.err_wrong_password'),
      'invalid-credential': t('login.err_invalid_credentials'),
    };
    const errors = method === 'phone' ? phoneErrors : emailErrors;
    return errors[code] ?? sharedErrors[code] ?? (message || t('common.error_generic'));
  };

  const clearVerifier = () => {
    verifierRef.current?.clear();
    verifierRef.current = null;
    recaptchaWidgetIdRef.current = null;
  };

  const resetRecaptcha = async () => {
    const verifier = verifierRef.current;
    if (!verifier) return;

    try {
      const widgetId = recaptchaWidgetIdRef.current ?? await verifier.render();
      recaptchaWidgetIdRef.current = widgetId;
      const recaptcha = (
        window as typeof window & {
          grecaptcha?: { reset: (id?: number) => void };
        }
      ).grecaptcha;

      if (!recaptcha) {
        clearVerifier();
        return;
      }
      recaptcha.reset(widgetId);
    } catch {
      clearVerifier();
    }
  };

  const ensureRecaptcha = async () => {
    if (verifierRef.current) return verifierRef.current;
    auth.languageCode = i18n.resolvedLanguage ?? i18n.language;

    // Firebase's invisible reCAPTCHA example binds the verifier directly to
    // the button that submits the phone sign-in form.
    const verifier = new RecaptchaVerifier(auth, sendButtonId, {
      size: 'invisible',
      badge: 'bottomright',
      callback: () => {
        // This mirrors Firebase's onSignInSubmit() example. requestSubmit()
        // also covers browsers where reCAPTCHA intercepts the original click.
        const form = document.getElementById(phoneFormId);
        if (form instanceof HTMLFormElement) form.requestSubmit();
      },
      'expired-callback': () => {
        void resetRecaptcha();
      },
    });
    verifierRef.current = verifier;

    try {
      recaptchaWidgetIdRef.current = await verifier.render();
      return verifier;
    } catch (error) {
      clearVerifier();
      throw error;
    }
  };

  const resetPhoneFlow = () => {
    clearVerifier();
    setConfirmationResult(null);
    setSmsCode('');
    setError('');
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendCodeInFlightRef.current) return;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone.valid) {
      setError(t('auth.err_invalid_phone'));
      return;
    }

    sendCodeInFlightRef.current = true;
    setBusyMethod('phone-send');
    setError('');
    try {
      const verifier = await ensureRecaptcha();
      let result: ConfirmationResult;
      if (mode === 'link') {
        if (!auth.currentUser) throw new Error(t('auth.err_no_user'));
        result = await linkWithPhoneNumber(auth.currentUser, normalizedPhone.e164, verifier);
      } else {
        result = await signInWithPhoneNumber(auth, normalizedPhone.e164, verifier);
      }
      setConfirmationResult(result);
    } catch (err) {
      console.error(`[auth:${mode === 'link' ? 'link-' : ''}phone-send]`, err);
      await resetRecaptcha();
      setError(mapAuthError(err, 'phone'));
    } finally {
      sendCodeInFlightRef.current = false;
      setBusyMethod(null);
    }
  };

  const handleConfirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmationResult) return;

    setBusyMethod('phone-confirm');
    setError('');
    try {
      await confirmationResult.confirm(smsCode);
      clearVerifier();
      if (mode === 'link') await reloadUser();
      onSuccess?.();
    } catch (err) {
      console.error(`[auth:${mode === 'link' ? 'link-' : ''}phone-confirm]`, err);
      setError(mapAuthError(err, 'phone'));
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
      setError(mapAuthError(err, 'email'));
    } finally {
      setBusyMethod(null);
    }
  };

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const codeComplete = /^\d{6}$/.test(smsCode);
  const phoneBusy = busyMethod === 'phone-send' || busyMethod === 'phone-confirm';

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
                if (confirmationResult) resetPhoneFlow();
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
            disabled={!normalizedPhone.valid || phoneBusy}
            type="submit"
          >
            {busyMethod === 'phone-send'
              ? t('auth.phone_sending')
              : confirmationResult
                ? t('auth.phone_resend_code')
                : t('auth.phone_send_code')}
          </button>
          <p className={styles.smsNote}>{t('auth.phone_sms_note')}</p>
        </form>

        {confirmationResult && (
          <form className={styles.codeForm} onSubmit={handleConfirmCode}>
            <div className={styles.sentNotice}>
              <HiOutlineCheckCircle size={18} />
              <span>{t('auth.phone_code_sent', { phone: normalizedPhone.e164 })}</span>
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
