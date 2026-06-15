import { useState } from 'react';
import { useApp } from '../context';
import { NumberInput } from '../components/NumberInput';
import type { FamilyMember, FamilyRelation, SalarySource } from '../types';
import styles from './Onboarding.module.css';

const GOALS = [
  { id: 'emergency_fund', label: 'Build emergency fund', icon: '🛡️' },
  { id: 'pay_debts',      label: 'Pay off debts faster', icon: '💳' },
  { id: 'save_vacation',  label: 'Save for vacation',    icon: '✈️' },
  { id: 'buy_home',       label: 'Buy a home',           icon: '🏠' },
  { id: 'reduce_spending',label: 'Reduce daily spending', icon: '📉' },
  { id: 'save_education', label: 'Save for education',   icon: '🎓' },
  { id: 'invest',         label: 'Start investing',      icon: '📈' },
  { id: 'retirement',     label: 'Save for retirement',  icon: '🏖️' },
];

const RELATIONS: { value: FamilyRelation; label: string }[] = [
  { value: 'spouse',  label: 'Spouse / Partner' },
  { value: 'child',   label: 'Child' },
  { value: 'parent',  label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other',   label: 'Other' },
];

interface Props {
  editing?: boolean;
  onDone?: () => void;
}

const Onboarding = ({ editing = false, onDone }: Props) => {
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
      setSaveError((e as { message?: string }).message ?? 'Failed to save. Please try again.');
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
          <h1 className={styles.introTitle}>Let's set up your financial profile</h1>
          <p className={styles.introText}>
            Answer a few quick questions so the AI can give you more accurate insights and predictions — taking into account your salary schedule, family events, and personal goals.
          </p>
          <p className={styles.introBullet}>📅 When you get paid</p>
          <p className={styles.introBullet}>👨‍👩‍👧 Family birthdays & events</p>
          <p className={styles.introBullet}>🎯 Your financial goals</p>
          <div className={styles.spacer} />
          <button className={styles.nextBtn} onClick={() => setStep(1)}>Get Started</button>
        </div>
      )}

      {/* Step 1: Salary sources */}
      {step === 1 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>Step 1 of {TOTAL_STEPS - 1}</p>
          <div className={styles.stepEmoji}>💰</div>
          <h2 className={styles.stepTitle}>Income sources</h2>
          <p className={styles.stepDesc}>
            Add all your income sources. Knowing your paydays helps the AI tell post-salary spending from end-of-month tightening.
          </p>

          {sources.length > 0 && (
            <div className={styles.memberList}>
              {sources.map(s => (
                <div key={s.id} className={styles.memberRow}>
                  <span className={styles.memberName}>{s.name}</span>
                  <span className={styles.memberMeta}>
                    day {s.day}{s.amount ? ` · ${s.amount.toLocaleString()} UZS` : ''}
                  </span>
                  <button className={styles.removeBtn} onClick={() => removeSource(s.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addMemberForm}>
            <input
              className={styles.textInput}
              placeholder='Source name (e.g. "Main job")'
              value={srcName}
              onChange={e => setSrcName(e.target.value)}
            />
            <div className={styles.rowFields}>
              <input
                className={styles.dayInput}
                type="number"
                min={1}
                max={31}
                placeholder="Pay day"
                value={srcDay}
                onChange={e => setSrcDay(e.target.value)}
              />
              <div className={styles.amountRow}>
                <NumberInput
                  className={styles.amountInput}
                  placeholder="Amount (opt.)"
                  value={srcAmtStr}
                  onChange={setSrcAmtStr}
                />
                <span className={styles.currency}>UZS</span>
              </div>
            </div>
            <button className={styles.addMemberBtn} onClick={addSource} disabled={!canAddSource}>
              + Add source
            </button>
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            {editing && <button className={styles.backBtn} onClick={onDone}>Cancel</button>}
            <button className={styles.nextBtn} onClick={() => setStep(2)} disabled={sources.length === 0}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Personal */}
      {step === 2 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>Step 2 of {TOTAL_STEPS - 1}</p>
          <div className={styles.stepEmoji}>🎂</div>
          <h2 className={styles.stepTitle}>Your birthday</h2>
          <p className={styles.stepDesc}>
            We'll remind you to plan for birthday expenses and personalize insights.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>Birthday (optional)</label>
            <input
              className={styles.dateInput}
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
            />
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(1)}>Back</button>
            <button className={styles.nextBtn} onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Family */}
      {step === 3 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>Step 3 of {TOTAL_STEPS - 1}</p>
          <div className={styles.stepEmoji}>👨‍👩‍👧</div>
          <h2 className={styles.stepTitle}>Family members</h2>
          <p className={styles.stepDesc}>
            Add family members so the AI can anticipate birthday expenses and seasonal spending.
          </p>

          {members.length > 0 && (
            <div className={styles.memberList}>
              {members.map(m => (
                <div key={m.id} className={styles.memberRow}>
                  <span className={styles.memberName}>{m.name}</span>
                  <span className={styles.memberMeta}>{m.relation}{m.birthday ? ` · ${m.birthday}` : ''}</span>
                  <button className={styles.removeBtn} onClick={() => removeMember(m.id)}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addMemberForm}>
            <input
              className={styles.textInput}
              placeholder="Name"
              value={memberName}
              onChange={e => setMemberName(e.target.value)}
            />
            <select
              className={styles.selectInput}
              value={memberRelation}
              onChange={e => setMemberRelation(e.target.value as FamilyRelation)}
            >
              {RELATIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input
              className={styles.dateInput}
              type="date"
              value={memberBirthday}
              onChange={e => setMemberBirthday(e.target.value)}
            />
            <button className={styles.addMemberBtn} onClick={addMember} disabled={!memberName.trim()}>
              + Add member
            </button>
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(2)}>Back</button>
            <button className={styles.nextBtn} onClick={() => setStep(4)}>Next</button>
          </div>
        </div>
      )}

      {/* Step 4: Goals */}
      {step === 4 && (
        <div className={styles.slide}>
          <p className={styles.stepLabel}>Step 4 of {TOTAL_STEPS - 1}</p>
          <div className={styles.stepEmoji}>🎯</div>
          <h2 className={styles.stepTitle}>Financial goals</h2>
          <p className={styles.stepDesc}>
            Select all that apply. The AI will tailor advice toward your goals.
          </p>

          <div className={styles.goalGrid}>
            {GOALS.map(g => (
              <button
                key={g.id}
                className={`${styles.goalBtn} ${goals.includes(g.id) ? styles.goalActive : ''}`}
                onClick={() => toggleGoal(g.id)}
              >
                <span className={styles.goalIcon}>{g.icon}</span>
                <span className={styles.goalLabel}>{g.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.spacer} />
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(3)}>Back</button>
            <button className={styles.nextBtn} onClick={() => setStep(5)}>Next</button>
          </div>
        </div>
      )}

      {/* Step 5: Comment tip + Done */}
      {step === 5 && (
        <div className={styles.slide}>
          <div className={styles.introEmoji}>✅</div>
          <h2 className={styles.stepTitle}>One more tip</h2>
          <p className={styles.stepDesc}>
            For the best analysis, <strong>always add a comment</strong> when recording transactions.
          </p>
          <div className={styles.tipCard}>
            <p className={styles.tipRow}>✍️ <span>"Bought groceries for the week"</span></p>
            <p className={styles.tipRow}>🎁 <span>"Gift for mom's birthday"</span></p>
            <p className={styles.tipRow}>🍽️ <span>"Dinner with colleagues"</span></p>
          </div>
          <p className={styles.tipNote}>
            Comments let the AI understand one-time vs. recurring expenses, spot patterns, and make smarter predictions.
          </p>

          <div className={styles.spacer} />
          {saveError && <p className={styles.saveError}>{saveError}</p>}
          <div className={styles.navRow}>
            <button className={styles.backBtn} onClick={() => setStep(4)}>Back</button>
            <button className={styles.nextBtn} onClick={handleFinish} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Profile' : 'Done!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
