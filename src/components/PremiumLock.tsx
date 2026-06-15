import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiStar, HiChevronRight, HiLockClosed } from 'react-icons/hi2';
import PremiumModal, { type PremiumFeatureKey } from './PremiumModal';
import { useEntitlements } from '../hooks/useEntitlements';
import styles from './PremiumLock.module.css';

export const PremiumBadge: React.FC<{ small?: boolean }> = () => {
  const { t } = useTranslation();
  return (
    <span className={styles.lockBadge}>
      <HiStar /> {t('premium.badge')}
    </span>
  );
};

export const PremiumLockIcon: React.FC = () => (
  <span className={styles.iconLock}><HiLockClosed size={11} /></span>
);

/** Small absolute-positioned star, intended for the top-right corner of a positioned parent. */
export const PremiumCornerStar: React.FC = () => (
  <span className={styles.cornerStar}><HiStar /></span>
);

interface BannerProps {
  feature: PremiumFeatureKey;
  title?: string;
  description?: string;
}

export const PremiumBanner: React.FC<BannerProps> = ({ feature, title, description }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.banner} onClick={() => setOpen(true)} type="button">
        <div className={styles.bannerIcon}><HiStar size={18} /></div>
        <div className={styles.bannerText}>
          <p className={styles.bannerTitle}>{title ?? t('premium.banner_title')}</p>
          <p className={styles.bannerDesc}>{description ?? t('premium.banner_desc')}</p>
        </div>
        <HiChevronRight size={18} className={styles.bannerArrow} />
      </button>
      {open && <PremiumModal feature={feature} onClose={() => setOpen(false)} />}
    </>
  );
};

interface PreviewProps {
  feature: PremiumFeatureKey;
  children: React.ReactNode;
}

export const PremiumPreview: React.FC<PreviewProps> = ({ feature, children }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.previewWrap}>
      <div className={styles.lockedRow}>{children}</div>
      <div className={styles.previewOverlay} onClick={() => setOpen(true)}>
        <button className={styles.previewBtn} type="button" onClick={() => setOpen(true)}>
          <HiStar size={16} /> {t('premium.unlock_with_premium')}
        </button>
      </div>
      {open && <PremiumModal feature={feature} onClose={() => setOpen(false)} />}
    </div>
  );
};

interface WallProps {
  feature: PremiumFeatureKey;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/** Full-page paywall: blurs children, overlays a centered upgrade card. Premium users pass through unchanged. */
export const PremiumWall: React.FC<WallProps> = ({ feature, title, description, children }) => {
  const { t } = useTranslation();
  const { isPremium } = useEntitlements();
  const [open, setOpen] = useState(false);

  if (isPremium) return <>{children}</>;

  const headline = title ?? t(`premium.headline_${featureKeyToHeadline(feature)}_title`);
  const sub = description ?? t(`premium.headline_${featureKeyToHeadline(feature)}_subtitle`);

  return (
    <div className={styles.wallWrap}>
      <div className={styles.wallContent}>{children}</div>
      <div className={styles.wallOverlay}>
        <button className={styles.wallCard} type="button" onClick={() => setOpen(true)}>
          <div className={styles.wallIcon}><HiLockClosed size={28} /></div>
          <p className={styles.wallTitle}>{headline}</p>
          <p className={styles.wallDesc}>{sub}</p>
          <span className={styles.wallBtn}>
            <HiStar size={16} /> {t('premium.cta_button')}
          </span>
        </button>
      </div>
      {open && <PremiumModal feature={feature} onClose={() => setOpen(false)} />}
    </div>
  );
};

function featureKeyToHeadline(key: PremiumFeatureKey): string {
  // Maps feature key → i18n headline key suffix (matches existing `premium.headline_*_title`).
  switch (key) {
    case 'ai_chat':       return 'ai';
    case 'cards':         return 'cards';
    case 'credit_cash':   return 'cards';
    case 'categories':    return 'cats';
    case 'budgets':       return 'budgets';
    case 'debts':         return 'debts';
    case 'deposits':      return 'deposits';
    case 'savings':       return 'savings';
    case 'calendar':      return 'calendar';
    case 'charts':        return 'charts';
    case 'filters':       return 'filters';
    case 'subscriptions': return 'subs';
    case 'generic':       return 'generic';
  }
}

export function usePremiumGate() {
  const [openFor, setOpenFor] = useState<PremiumFeatureKey | null>(null);
  const open = (feature: PremiumFeatureKey) => setOpenFor(feature);
  const close = () => setOpenFor(null);
  const node = openFor ? <PremiumModal feature={openFor} onClose={close} /> : null;
  return { open, close, node, isOpen: openFor !== null };
}
