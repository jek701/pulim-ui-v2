import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiTrash, HiPlus, HiChevronDown, HiChevronUp, HiArrowRightOnRectangle, HiExclamationTriangle } from 'react-icons/hi2';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useApp } from '../context';
import { useCategories } from '../hooks/useCategories';
import { useTransactions } from '../hooks/useTransactions';
import { useBudgets } from '../hooks/useBudgets';
import { useEntitlements } from '../hooks/useEntitlements';
import { useUserSettings } from '../hooks/useUserSettings';
import { usePremiumGate, PremiumBadge } from '../components/PremiumLock';
import { HiStar, HiLockClosed } from 'react-icons/hi2';
import dayjs from '../utils/dayjs';
import type { NewCategory } from '../hooks/useCategories';
import type { CategoryType } from '../types';
import Modal from '../components/Modal';
import { Input, Select } from '../components/FormField';
import { BudgetInput } from '../components/NumberInput';
import { formatAmount } from '../utils/format';
import Onboarding from './Onboarding';
import EmojiInput from '../components/EmojiInput';
import HomeWidgetsSettings from '../components/HomeWidgetsSettings';
import type { HomeWidgetSetting } from '../utils/homeWidgets';
import styles from './Settings.module.css';

const COLORS = ['#30D158','#0A84FF','#5E5CE6','#BF5AF2','#FF9F0A','#FF375F','#FF453A','#5AC8FA','#FFD60A','#636366'];
const ICON_SUGGESTIONS = ['💼','💻','📈','🎁','🏪','💰','🍔','🚗','🛍️','💡','🎮','🏥','📚','🏠','✈️','💈','📦','🏦','🎓','🍕'];

const EMPTY_CAT = (): NewCategory => ({ name: '', icon: '📦', color: '#5E5CE6', type: 'expense' });

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, saveProfile } = useApp();
  const [editingProfile, setEditingProfile] = useState(false);
  const { categories, subcategories, addCategory, removeCategory, addSubcategory, removeSubcategory } = useCategories(user?.uid ?? null);
  const { clearAll: clearAllTransactions } = useTransactions(user?.uid ?? null);
  const { setBudget, getBudget } = useBudgets(user?.uid ?? null);
  const { plannedExpenseVisibility, setPlannedExpenseVisibility } = useUserSettings(user?.uid ?? null);
  const { isPremium, isTrial, trialDaysLeft, aiUsed } = useEntitlements();
  const premiumGate = usePremiumGate();

  const [catTab, setCatTab] = useState<'expense' | 'income'>('expense');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<NewCategory>(EMPTY_CAT());
  const [subName, setSubName] = useState('');
  const [saving, setSaving] = useState(false);
  const accountName = profile?.name?.trim()
    || user?.displayName?.trim()
    || user?.email
    || user?.phoneNumber
    || '';
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || '#';
  const setFormField = <K extends keyof NewCategory>(k: K, v: NewCategory[K]) =>
    setCatForm(f => ({ ...f, [k]: v }));

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return;
    if (!isPremium) { premiumGate.open('categories'); return; }
    setSaving(true);
    try {
      await addCategory(catForm);
      setShowAddCat(false);
      setCatForm(EMPTY_CAT());
    } finally { setSaving(false); }
  };

  const handleAddSub = async (catId: string) => {
    if (!subName.trim()) return;
    if (!isPremium) { premiumGate.open('categories'); return; }
    setSaving(true);
    try {
      await addSubcategory({ name: subName.trim(), categoryId: catId });
      setShowAddSub(null);
      setSubName('');
    } finally { setSaving(false); }
  };

  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  const filteredCats = categories.filter(c => c.type === catTab || c.type === 'both');
  const getSubs = (catId: string) => subcategories.filter(s => s.categoryId === catId);

  if (editingProfile) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'var(--tg-top)',
      }}>
        <Onboarding editing onDone={() => setEditingProfile(false)} />
      </div>
    );
  }

  const premiumUntil = profile?.subscription?.premiumUntil;
  const aiUsageLine = isPremium
    ? t('settings.sub_premium_active')
    : t('premium.ai_usage_banner', { used: aiUsed, limit: 10 });

  return (
    <div className={styles.page}>
      {/* Subscription card */}
      <div className={styles.section}>
        <button
          type="button"
          onClick={() => premiumGate.open('generic')}
          style={{
            width: '100%',
            borderRadius: 16,
            padding: 16,
            background: isPremium
              ? 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'
              : 'linear-gradient(135deg, rgba(124, 58, 237, 0.10), rgba(236, 72, 153, 0.06))',
            color: isPremium ? '#fff' : 'var(--text)',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            boxShadow: isPremium ? '0 8px 24px rgba(124, 58, 237, 0.30)' : 'none',
            border: isPremium ? 'none' : '1px solid rgba(124, 58, 237, 0.18)',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: isPremium ? 'rgba(255,255,255,0.22)' : 'linear-gradient(135deg, #7C3AED, #EC4899)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HiStar size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              {isPremium
                ? (isTrial ? t('settings.sub_premium_trial') : t('settings.sub_premium_title'))
                : t('settings.sub_free_title')}
            </p>
            <p style={{ fontSize: 12, margin: '2px 0 0', opacity: isPremium ? 0.9 : 0.7 }}>
              {isPremium && isTrial && trialDaysLeft != null
                ? t('settings.sub_trial_days_left', { n: trialDaysLeft })
                : isPremium && premiumUntil
                ? t('settings.sub_renews_on', { date: dayjs(premiumUntil).format('D MMM YYYY') })
                : aiUsageLine}
            </p>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: 10,
            background: isPremium ? 'rgba(255,255,255,0.22)' : 'linear-gradient(135deg, #7C3AED, #EC4899)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {isPremium ? t('settings.sub_manage_btn') : t('settings.sub_upgrade_btn')}
          </div>
        </button>

        {/*{!isPremium && (*/}
        {/*  <div style={{*/}
        {/*    marginTop: 10,*/}
        {/*    background: 'var(--surface2)',*/}
        {/*    borderRadius: 12,*/}
        {/*    padding: 12,*/}
        {/*    display: 'flex',*/}
        {/*    gap: 12,*/}
        {/*  }}>*/}
        {/*    <div style={{ flex: 1 }}>*/}
        {/*      <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{t('settings.sub_ai_usage')}</p>*/}
        {/*      <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0' }}>{aiUsed} / 10</p>*/}
        {/*    </div>*/}
        {/*    <div style={{ flex: 1 }}>*/}
        {/*      <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{t('settings.sub_cards_usage')}</p>*/}
        {/*      <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0' }}>{cardCount} / {limits.cards}</p>*/}
        {/*    </div>*/}
        {/*    <div style={{ flex: 1 }}>*/}
        {/*      <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>AI {t('ask_ai.title')}</p>*/}
        {/*      <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0' }}>{chats.length} / 1</p>*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*)}*/}
      </div>

      {/* Profile */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('settings.section_account')}</p>
        <div className={styles.profileCard}>
          <div className={styles.profileAvatar}>{accountInitial}</div>
          <div className={styles.profileInfo}>
            <p className={styles.profileEmail}>{accountName}</p>
            {profile?.name && (user?.phoneNumber || user?.email) && (
              <p className={styles.profileContact}>{user.phoneNumber ?? user.email}</p>
            )}
            <p className={styles.profileSub}>{t('settings.personal_account')}</p>
          </div>
          <button className={styles.signOutBtn} onClick={() => signOut(auth)}>
            <HiArrowRightOnRectangle size={18} />
          </button>
        </div>
      </div>

      {/* Financial Profile */}
      {/*<div className={styles.section}>*/}
      {/*  <div className={styles.sectionHeader}>*/}
      {/*    <p className={styles.sectionLabel}>{t('settings.section_profile')}</p>*/}
      {/*    <button className={styles.smallAddBtn} onClick={() => setEditingProfile(true)}>*/}
      {/*      <HiPencil size={13} /> {t('common.edit')}*/}
      {/*    </button>*/}
      {/*  </div>*/}
      {/*  {profile ? (*/}
      {/*    <div className={styles.profileInfoCard}>*/}
      {/*      {profile.salarySources?.length > 0 && (*/}
      {/*        <div className={styles.profileInfoRow}>*/}
      {/*          <span className={styles.profileInfoIcon}>📅</span>*/}
      {/*          <span className={styles.profileInfoText}>*/}
      {/*            {profile.salarySources.map(s => `${s.name} (day ${s.day})`).join(', ')}*/}
      {/*          </span>*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*      {profile.birthday && (*/}
      {/*        <div className={styles.profileInfoRow}>*/}
      {/*          <span className={styles.profileInfoIcon}>🎂</span>*/}
      {/*          <span className={styles.profileInfoText}>Birthday: <strong>{profile.birthday}</strong></span>*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*      {profile.familyMembers?.length > 0 && (*/}
      {/*        <div className={styles.profileInfoRow}>*/}
      {/*          <span className={styles.profileInfoIcon}>👨‍👩‍👧</span>*/}
      {/*          <span className={styles.profileInfoText}>{profile.familyMembers.map(m => m.name).join(', ')}</span>*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*      {profile.financialGoals?.length > 0 && (*/}
      {/*        <div className={styles.profileInfoGoals}>*/}
      {/*          {profile.financialGoals.map(g => (*/}
      {/*            <span key={g} className={styles.goalChip}>{GOAL_LABELS[g] ?? g}</span>*/}
      {/*          ))}*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*  ) : (*/}
      {/*    <button className={styles.setupProfileBtn} onClick={() => setEditingProfile(true)}>*/}
      {/*      {t('settings.btn_setup_profile')}*/}
      {/*    </button>*/}
      {/*  )}*/}
      {/*</div>*/}

      {/* Home widgets */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('settings.section_home_widgets')}</p>
        <p className={styles.hint}>{t('settings.home_widgets_hint')}</p>
        <HomeWidgetsSettings
          value={profile?.homeWidgets ?? null}
          onChange={(next: HomeWidgetSetting[]) => saveProfile({ homeWidgets: next })}
        />
      </div>

      {/* Language */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('settings.section_language')}</p>
        <div className={styles.catTypeTabs}>
          <button
              className={`${styles.catTypeBtn} ${i18n.language === 'uz' ? styles.catTypeActive : ''}`}
              onClick={() => switchLanguage('uz')}
          >
            {t('settings.lang_uz')}
          </button>
          <button
            className={`${styles.catTypeBtn} ${i18n.language === 'en' ? styles.catTypeActive : ''}`}
            onClick={() => switchLanguage('en')}
          >
            {t('settings.lang_en')}
          </button>
          <button
            className={`${styles.catTypeBtn} ${i18n.language === 'ru' ? styles.catTypeActive : ''}`}
            onClick={() => switchLanguage('ru')}
          >
            {t('settings.lang_ru')}
          </button>
        </div>
      </div>

      {/* Planned expenses */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('settings.section_planned_expenses')}</p>
        <p className={styles.hint}>{t('settings.planned_expenses_hint')}</p>
        <div className={styles.settingCard}>
          <Select
            label={t('settings.planned_visibility_label')}
            value={plannedExpenseVisibility}
            onChange={e => setPlannedExpenseVisibility(e.target.value as typeof plannedExpenseVisibility)}
            options={[
              { value: 'hidden', label: t('settings.planned_visibility_hidden') },
              { value: '7d', label: t('settings.planned_visibility_7d') },
              { value: '14d', label: t('settings.planned_visibility_14d') },
              { value: 'this_month', label: t('settings.planned_visibility_this_month') },
              { value: 'next_month', label: t('settings.planned_visibility_next_month') },
            ]}
          />
        </div>
      </div>

      {/* Categories */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionLabel}>
            {t('settings.section_categories')}
            {!isPremium && <span style={{ marginLeft: 8, verticalAlign: 'middle' }}><PremiumBadge /></span>}
          </p>
          <button
            className={styles.smallAddBtn}
            onClick={() => isPremium ? setShowAddCat(true) : premiumGate.open('categories')}
            style={!isPremium ? { display: 'inline-flex', alignItems: 'center', gap: 4 } : undefined}
          >
            {!isPremium ? <HiLockClosed size={12} /> : <HiPlus size={14} />} {t('common.add')}
          </button>
        </div>

        <div className={styles.catTypeTabs}>
          <button className={`${styles.catTypeBtn} ${catTab === 'expense' ? styles.catTypeActive : ''}`} onClick={() => setCatTab('expense')}>{t('settings.tab_expense')}</button>
          <button className={`${styles.catTypeBtn} ${catTab === 'income' ? styles.catTypeActive : ''}`} onClick={() => setCatTab('income')}>{t('settings.tab_income')}</button>
        </div>

        <div className={styles.catList}>
          {filteredCats.length === 0 && (
            <p className={styles.emptyText}>{catTab === 'expense' ? t('settings.no_expense_cats') : t('settings.no_income_cats')}</p>
          )}
          {filteredCats.map(cat => {
            const subs = getSubs(cat.id);
            const expanded = expandedCat === cat.id;
            const showBudget = cat.type === 'expense' || cat.type === 'both';
            return (
              <div key={cat.id} className={styles.catItem}>
                <div className={styles.catRow} onClick={() => setExpandedCat(expanded ? null : cat.id)}>
                  <div className={styles.catIconWrap} style={{ background: cat.color + '22' }}>
                    <span>{cat.icon}</span>
                  </div>
                  <span className={styles.catName}>{cat.name}</span>
                  {subs.length > 0 && <span className={styles.subCount}>{subs.length}</span>}
                  {showBudget && (
                    <BudgetInput
                      key={getBudget(cat.id)?.amount ?? cat.id}
                      className={styles.catBudgetInput}
                      placeholder={isPremium ? t('settings.budget_placeholder') : '🔒'}
                      initialValue={getBudget(cat.id)?.amount}
                      onSave={v => {
                        if (!isPremium) { premiumGate.open('budgets'); return; }
                        if (v > 0) setBudget(cat.id, v, 'UZS');
                        else if (v === 0 && getBudget(cat.id)) setBudget(cat.id, 0, 'UZS');
                      }}
                      onClick={(e: React.MouseEvent) => { if (!isPremium) { e.stopPropagation(); premiumGate.open('budgets'); } else { e.stopPropagation(); } }}
                    />
                  )}
                  <div className={styles.catRowActions}>
                    {expanded ? <HiChevronUp size={16} color="var(--text3)" /> : <HiChevronDown size={16} color="var(--text3)" />}
                    <button className={styles.catDelBtn} onClick={e => { e.stopPropagation(); if(confirm(t('settings.confirm_delete_category'))) removeCategory(cat.id); }}>
                      <HiTrash size={14} />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className={styles.subSection}>
                    {subs.map(s => (
                      <div key={s.id} className={styles.subItem}>
                        <span>— {s.name}</span>
                        <button onClick={() => confirm(t('settings.confirm_delete_subcategory')) && removeSubcategory(s.id)}>
                          <HiTrash size={13} />
                        </button>
                      </div>
                    ))}
                    <button className={styles.addSubBtn} onClick={() => setShowAddSub(cat.id)}>
                      <HiPlus size={13} /> {t('settings.btn_add_subcategory')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Category modal */}
      {showAddCat && (
        <Modal
          title={t('settings.modal_new_category')}
          onClose={() => { setShowAddCat(false); setCatForm(EMPTY_CAT()); }}
          footer={
            <button className={`${styles.saveBtn} ${saving ? styles.disabled : ''}`} onClick={handleAddCategory} disabled={saving}>
              {saving ? t('common.saving') : t('settings.btn_add_category')}
            </button>
          }
        >
          <Input label={t('common.name')} placeholder={t('settings.category_name_placeholder')} value={catForm.name} onChange={e => setFormField('name', e.target.value)} />
          <Select
            label={t('common.type')}
            value={catForm.type}
            onChange={e => setFormField('type', e.target.value as CategoryType)}
            options={[
              { value: 'expense', label: t('settings.type_expense') },
              { value: 'income',  label: t('settings.type_income') },
              { value: 'both',    label: t('settings.type_both') },
            ]}
          />
          <EmojiInput
            label={t('settings.icon_label')}
            value={catForm.icon}
            onChange={icon => setFormField('icon', icon)}
            suggestions={ICON_SUGGESTIONS}
          />
          <div>
            <p className={styles.pickLabel}>{t('settings.color_label')}</p>
            <div className={styles.colorRow}>
              {COLORS.map(color => (
                <button
                  key={color}
                  className={`${styles.colorBtn} ${catForm.color === color ? styles.colorActive : ''}`}
                  style={{ background: color }}
                  onClick={() => setFormField('color', color)}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Monthly Budgets */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>
          {t('settings.section_budgets')}
          {!isPremium && <span style={{ marginLeft: 8, verticalAlign: 'middle' }}><PremiumBadge /></span>}
        </p>
        <div className={styles.budgetList}>
          <div className={styles.budgetItem}>
            <span className={styles.budgetIcon}>💰</span>
            <span className={styles.budgetName}>{t('settings.label_salary')}</span>
            <BudgetInput
              key={getBudget('__income__')?.amount ?? 'income'}
              className={styles.budgetInput}
              placeholder={isPremium ? '0' : '🔒'}
              initialValue={getBudget('__income__')?.amount}
              onSave={v => { if (!isPremium) { premiumGate.open('budgets'); return; } if (v > 0) setBudget('__income__', v, 'UZS'); }}
              onClick={(e: React.MouseEvent) => { if (!isPremium) { e.preventDefault(); premiumGate.open('budgets'); } }}
            />
            <span className={styles.budgetCurrency}>UZS</span>
          </div>

          <div className={styles.budgetDivider} />

          <div className={styles.budgetItem}>
            <span className={styles.budgetIcon}>💳</span>
            <span className={styles.budgetName}>{t('settings.label_debt_payments')}</span>
            <BudgetInput
              key={getBudget('__debts__')?.amount ?? '__debts__'}
              className={styles.budgetInput}
              placeholder={isPremium ? '0' : '🔒'}
              initialValue={getBudget('__debts__')?.amount}
              onSave={v => { if (!isPremium) { premiumGate.open('budgets'); return; } if (v > 0) setBudget('__debts__', v, 'UZS'); }}
              onClick={(e: React.MouseEvent) => { if (!isPremium) { e.preventDefault(); premiumGate.open('budgets'); } }}
            />
            <span className={styles.budgetCurrency}>UZS</span>
          </div>

          {getBudget('__subscription__') && (getBudget('__subscription__')?.amount ?? 0) > 0 && (
            <>
              <div className={styles.budgetDivider} />
              <div className={styles.budgetItem}>
                <span className={styles.budgetIcon}>📡</span>
                <span className={styles.budgetName}>{t('settings.label_subscriptions')}</span>
                <span className={styles.budgetAutoValue}>{formatAmount(getBudget('__subscription__')?.amount ?? 0)}</span>
                <span className={styles.budgetCurrency}>UZS</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('settings.section_danger')}</p>
        <div className={styles.dangerCard}>
          <button
            className={styles.dangerBtn}
            onClick={async () => {
              if (!confirm(t('settings.confirm_clear_transactions'))) return;
              await clearAllTransactions();
            }}
          >
            <HiExclamationTriangle size={16} />
            {t('settings.btn_clear_transactions')}
          </button>
        </div>
      </div>

      {/* Add Subcategory modal */}
      {showAddSub && (
        <Modal
          title={t('settings.modal_new_subcategory')}
          onClose={() => { setShowAddSub(null); setSubName(''); }}
          footer={
            <button className={`${styles.saveBtn} ${saving ? styles.disabled : ''}`} onClick={() => handleAddSub(showAddSub)} disabled={saving}>
              {saving ? t('common.saving') : t('settings.btn_add_subcategory_save')}
            </button>
          }
        >
          <p className={styles.parentCatLabel}>
            {t('settings.subcategory_under', { name: categories.find(c => c.id === showAddSub)?.name })}
          </p>
          <Input label={t('settings.subcategory_name_label')} placeholder={t('settings.subcategory_name_placeholder')} value={subName} onChange={e => setSubName(e.target.value)} />
        </Modal>
      )}
      {premiumGate.node}
    </div>
  );
};

export default Settings;
