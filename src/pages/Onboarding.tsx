import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context';
import { NumberInput } from '../components/NumberInput';
import { formatAmount } from '../utils/format';
import type { FamilyMember, FamilyRelation, SalarySource } from '../types';
import styles from './Onboarding.module.css';

// Labels are i18n key suffixes; the `onboarding.*` strings already existed in all
// three locales, the screen simply never used them.
const GOALS = [
  { id: 'emergency_fund',  key: 'goal_emergency', icon: '🛡️' },
  { id: 'pay_debts',       key: 'goal_debts',     icon: '💳' },
  { id: 'save_vacation',   key: 'goal_vacation',  icon: '✈️' },
  { id: 'buy_home',        key: 'goal_home',      icon: '🏠' },
  { id: 'reduce_spending', key: 'goal_reduce',    icon: '📉' },
  { id: 'save_education',  key: 'goal_education', icon: '🎓' },
  { id: 'invest',          key: 'goal_invest',    icon: '📈' },
  { id: 'retirement',      key: 'goal_retirement', icon: '🏖️' },
];

const RELATIONS: FamilyRelation[] = ['spouse', 'child', 'parent', 'sibling', 'other'];

interface Props {
  editing?: boolean;
  onDone?: () => void;
}

const Onboarding = ({ editing = false, onDone }: Props) => {
  const { t } = useTranslation();
  const { profile, saveProfile } = useApp();

  const [step, setStep] = useState(editing ? 1 : 0);

  // Salary sources
  const [sources, setSources] = useState<SalarySource[]>(
    profile?.salarySources?.length ? profile.salarySources : []
  );
  const [srcName, setSrcName] = useState('');
  const [srcDay, setSrcDay] = useState('');
  const [srcAmtStr, setSrcAmtStr] = useState('');

  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [members, setMembers] = useState<FamilyMember[]>(profile?.familyMembers ?? []);
  const [goals, setGoals] = useState<string[]>(profile?.financialGoals ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Family member form
  const [memberName, setMemberName] = useState('');
  const [memberBirthday, setMemberBirthday] = useState('');
  const [memberRelation, setMemberRelation] = useState<FamilyRelation>('child');

  const TOTAL_STEPS = 5;
  const progress = (step / TOTAL_STEPS) * 100;

  // ── Salary sources ──────────────────────────────────────────────────────
  const canAddSource = srcName.trim() !== '' && parseInt(srcDay) >= 1 && parseInt(srcDay) <= 31;

  const addSource = () => {
    if (!canAddSource) return;
    const s: SalarySource = {
      id: Date.now().toString(),
      name: srcName.trim(),
      day: parseInt(srcDay),
      amount: parseFloat(srcAmtStr.replace(/,/g, '')) || undefined,
    };
    setSources(prev => [...prev, s]);
    setSrcName('');
    setSrcDay('');
    setSrcAmtStr('');
  };

  const removeSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  // ── Family ──────────────────────────────────────────────────────────────
  const addMember = () => {
    if (!memberName.trim()) return;
    const m: FamilyMember = {
      id: Date.now().toString(),
      name: memberName.trim(),
      birthday: memberBirthday,
      relation: memberRelation,
    };
    setMembers(prev => [...prev, m]);
    setMemberName('');
    setMemberBirthday('');
    setMemberRelation('child');
  };

  const removeMember = (id: string) => setMembers(prev => prev.filter(m => m.id !== id));

  const toggleGoal = (id: string) =>
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await saveProfile({
        salarySources: sources,
        birthday: birthday || undefined,
        familyMembers: members,
        financialGoals: goals,
        onboardingComplete: true,
      });
      onDone?.();
    } catch (e: unknown) {
      console.error('[Onboarding] saveProfile error:', e);
      setSaveError((e as { message?: string }).message ?? t('common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {step > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Step 0: Intro */}
      {step === 0 && (
        <div className={styles.slide}>
          <div className={styles.introEmoji}>🧠</div>
          <h1 className={styles.introTitle}>{t('onboarding.title')}</h1>
          <p className={styles.introText}>{t('onboarding.subtitle')}</p>
          <p className={styles.introBullet}>{t('onboarding.step_salary')}</p>
          <p className={styles.introBullet}>{t('onboarding.step_family')}</p>
          <p className={styles.introBullet}>{t('onboarding.step_goals')}</p>
          <div className={styles.spacer} />
          <button className={styles.nextBtn} onClick={() => setStep(1)}>{t('onboarding.btn_start')}</button>
        </div>
      )}

      {/* Step 1: Salary sources */}
      {step === 1 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>{t('onboarding.step_of', { current: 1, total: TOTAL_STEPS - 1 })}</p>
          <div className={styles.stepEmoji}>💰</div>
          <h2 className={styles.stepTitle}>{t('onboarding.salary_heading')}</h2>
          <p className={styles.stepDesc}>{t('onboarding.salary_desc')}</p>

          {sources.length > 0 && (
            <div className={styles.memberList}>
              {sources.map(s => (
                <div key={s.id} className={styles.memberRow}>
                  <span className={styles.memberName}>{s.name}</span>
                  <span className={styles.memberMeta}>
                    {t('onboarding.source_day_meta', { day: s.day })}{s.amount ? ` · ${formatAmount(s.amount)}` : ''}
                  </span>
                  <button className={styles.removeBtn} onClick={() => removeSource(s.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addMemberForm}>
            <input
              className={styles.textInput}
              placeholder={t('onboarding.salary_name_placeholder')}
              value={srcName}
              onChange={e => setSrcName(e.target.value)}
            />
            <div className={styles.rowFields}>
              <input
                className={styles.dayInput}
                type="number"
                min={1}
                max={31}
                placeholder={t('onboarding.salary_day_placeholder')}
                value={srcDay}
                onChange={e => setSrcDay(e.target.value)}
              />
              <div className={styles.amountRow}>
                <NumberInput
                  className={styles.amountInput}
                  placeholder={t('onboarding.salary_amount_placeholder')}
                  value={srcAmtStr}
                  onChange={setSrcAmtStr}
                />
                <span className={styles.currency}>UZS</span>
              </div>
            </div>
            <button className={styles.addMemberBtn} onClick={addSource} disabled={!canAddSource}>
              {t('onboarding.salary_add')}
            </button>
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            {editing && <button className={styles.backBtn} onClick={onDone}>{t('common.cancel')}</button>}
            <button className={styles.nextBtn} onClick={() => setStep(2)} disabled={sources.length === 0}>
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Personal */}
      {step === 2 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>{t('onboarding.step_of', { current: 2, total: TOTAL_STEPS - 1 })}</p>
          <div className={styles.stepEmoji}>🎂</div>
          <h2 className={styles.stepTitle}>{t('onboarding.birthday_heading')}</h2>
          <p className={styles.stepDesc}>{t('onboarding.birthday_desc')}</p>

          <div className={styles.field}>
            <label className={styles.label}>{t('onboarding.birthday_label')}</label>
            <input
              className={styles.dateInput}
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
            />
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(1)}>{t('common.back')}</button>
            <button className={styles.nextBtn} onClick={() => setStep(3)}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step 3: Family */}
      {step === 3 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>{t('onboarding.step_of', { current: 3, total: TOTAL_STEPS - 1 })}</p>
          <div className={styles.stepEmoji}>👨‍👩‍👧</div>
          <h2 className={styles.stepTitle}>{t('onboarding.family_heading')}</h2>
          <p className={styles.stepDesc}>{t('onboarding.family_desc')}</p>

          {members.length > 0 && (
            <div className={styles.memberList}>
              {members.map(m => (
                <div key={m.id} className={styles.memberRow}>
                  <span className={styles.memberName}>{m.name}</span>
                  <span className={styles.memberMeta}>{t(`onboarding.relation_${m.relation}`)}{m.birthday ? ` · ${m.birthday}` : ''}</span>
                  <button className={styles.removeBtn} onClick={() => removeMember(m.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addMemberForm}>
            <input
              className={styles.textInput}
              placeholder={t('onboarding.family_name_placeholder')}
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
            />
            <select
              className={styles.selectInput}
              value={memberRelation}
              onChange={e => setMemberRelation(e.target.value as FamilyRelation)}
            >
              {RELATIONS.map(r => <option key={r} value={r}>{t(`onboarding.relation_${r}`)}</option>)}
            </select>
            <input
              className={styles.dateInput}
              type="date"
              value={memberBirthday}
              onChange={e => setMemberBirthday(e.target.value)}
            />
            <button className={styles.addMemberBtn} onClick={addMember} disabled={!memberName.trim()}>
              {t('onboarding.family_add')}
            </button>
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(2)}>{t('common.back')}</button>
            <button className={styles.nextBtn} onClick={() => setStep(4)}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step 4: Goals */}
      {step === 4 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>{t('onboarding.step_of', { current: 4, total: TOTAL_STEPS - 1 })}</p>
          <div className={styles.stepEmoji}>🎯</div>
          <h2 className={styles.stepTitle}>{t('onboarding.goals_heading')}</h2>
          <p className={styles.stepDesc}>{t('onboarding.goals_desc')}</p>

          <div className={styles.goalGrid}>
            {GOALS.map(g => (
              <button
                key={g.id}
                className={`${styles.goalBtn} ${goals.includes(g.id) ? styles.goalActive : ''}`}
                onClick={() => toggleGoal(g.id)}
              >
                <span className={styles.goalIcon}>{g.icon}</span>
                <span className={styles.goalLabel}>{t(`onboarding.${g.key}`)}</span>
              </button>
            ))}
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(3)}>{t('common.back')}</button>
            <button className={styles.nextBtn} onClick={() => setStep(5)}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step 5: Comment tip + Done */}
      {step === 5 && (
        <div className={styles.slide}>
          <div className={styles.introEmoji}>✅</div>
          <h2 className={styles.stepTitle}>{t('onboarding.tip_heading')}</h2>
          <p className={styles.stepDesc}>{t('onboarding.tip_desc')}</p>
          <div className={styles.tipCard}>
            <p className={styles.tipRow}>✍️ <span>{t('onboarding.tip_example1')}</span></p>
            <p className={styles.tipRow}>🎁 <span>{t('onboarding.tip_example2')}</span></p>
            <p className={styles.tipRow}>🍽️ <span>{t('onboarding.tip_example3')}</span></p>
          </div>
          <p className={styles.tipNote}>{t('onboarding.tip_footer')}</p>

          <div className={styles.spacer} />
          {saveError && <p className={styles.saveError}>{saveError}</p>}
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(4)}>{t('common.back')}</button>
            <button className={styles.nextBtn} onClick={handleFinish} disabled={saving}>
              {saving ? t('common.saving') : editing ? t('onboarding.btn_save') : t('onboarding.btn_done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
