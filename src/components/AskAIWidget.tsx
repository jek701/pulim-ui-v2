import { useTranslation } from 'react-i18next';
import { HiSparkles, HiArrowRight } from 'react-icons/hi2';
import styles from './AskAIWidget.module.css';

interface Props {
  onOpen: () => void;
}

const AskAIWidget = ({ onOpen }: Props) => {
  const { t } = useTranslation();
  return (
    <button className={styles.card} onClick={onOpen} type="button">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shimmer} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <HiSparkles size={22} className={styles.icon} />
        </div>
        <div className={styles.text}>
          <p className={styles.title}>{t('home.ask_ai_title')}</p>
          <p className={styles.subtitle}>{t('home.ask_ai_subtitle')}</p>
        </div>
        <HiArrowRight size={18} className={styles.arrow} />
      </div>
    </button>
  );
};

export default AskAIWidget;
