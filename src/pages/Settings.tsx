import {useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {
    HiArrowRightOnRectangle,
    HiCalendarDays,
    HiCheck,
    HiChevronDown,
    HiChevronLeft,
    HiChevronRight,
    HiChevronUp,
    HiCircleStack,
    HiExclamationTriangle,
    HiLanguage,
    HiLockClosed,
    HiPencil,
    HiPlus,
    HiShieldCheck,
    HiSquares2X2,
    HiStar,
    HiTag,
    HiTrash,
    HiWallet,
} from 'react-icons/hi2';
import {signOut} from 'firebase/auth';
import {auth} from '../firebase';
import {useApp} from '../context';
import {useCategories} from '../hooks/useCategories';
import {useTransactions} from '../hooks/useTransactions';
import {useBudgets} from '../hooks/useBudgets';
import {useEntitlements} from '../hooks/useEntitlements';
import {useUserSettings} from '../hooks/useUserSettings';
import {usePremiumGate, PremiumBadge} from '../components/PremiumLock';
import {useConfirm} from '../components/ConfirmDialog';
import dayjs from '../utils/dayjs';
import type {NewCategory} from '../hooks/useCategories';
import type {Category, CategoryType, Subcategory} from '../types';
import Modal from '../components/Modal';
import {Input, Select} from '../components/FormField';
import {BudgetInput} from '../components/NumberInput';
import {formatAmount} from '../utils/format';
import Onboarding from './Onboarding';
import EmojiInput from '../components/EmojiInput';
import HomeWidgetsSettings from '../components/HomeWidgetsSettings';
import {resolveHomeWidgets, type HomeWidgetSetting} from '../utils/homeWidgets';
import {DEFAULT_CATEGORIES} from '../utils/defaultCategories';
import styles from './Settings.module.css';

const COLORS = ['#30D158', '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF9F0A', '#FF375F', '#FF453A', '#5AC8FA', '#FFD60A', '#636366'];
const ICON_SUGGESTIONS = ['💼', '💻', '📈', '🎁', '🏪', '💰', '🍔', '🚗', '🛍️', '💡', '🎮', '🏥', '📚', '🏠', '✈️', '💈', '📦', '🏦', '🎓', '🍕'];

const EMPTY_CAT = (): NewCategory => ({name: '', icon: '📦', color: '#5E5CE6', type: 'expense'});

const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
    Salary: 'salary',
    Freelance: 'freelance',
    Investments: 'investments',
    Gift: 'gift',
    Business: 'business',
    'Other Income': 'other_income',
    Food: 'food',
    Transport: 'transport',
    Shopping: 'shopping',
    Bills: 'bills',
    Entertainment: 'entertainment',
    Health: 'health',
    Education: 'education',
    Housing: 'housing',
    Travel: 'travel',
    Beauty: 'beauty',
    Other: 'other',
};

const isDefaultCategory = (category: { name: string; icon: string; type: CategoryType }) => (
    DEFAULT_CATEGORIES.some(defaultCategory => (
        defaultCategory.name === category.name
        && defaultCategory.icon === category.icon
        && defaultCategory.type === category.type
    ))
);

type SettingsView = 'home' | 'account' | 'widgets' | 'language' | 'planning' | 'categories' | 'budgets' | 'data';

interface MenuRowProps {
    icon: ReactNode;
    title: string;
    subtitle?: string;
    value?: string;
    onClick: () => void;
}

const MenuRow = ({icon, title, subtitle, value, onClick}: MenuRowProps) => (
    <button className={styles.menuRow} type="button" onClick={onClick}>
        <span className={styles.menuIcon}>{icon}</span>
        <span className={styles.menuCopy}>
      <span className={styles.menuTitle}>{title}</span>
            {subtitle && <span className={styles.menuSubtitle}>{subtitle}</span>}
    </span>
        {value && <span className={styles.menuValue}>{value}</span>}
        <HiChevronRight className={styles.menuChevron} size={17}/>
    </button>
);

interface SubpageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    onBack: () => void;
}

const SubpageHeader = ({title, subtitle, icon, onBack}: SubpageHeaderProps) => {
    const {t} = useTranslation();

    return (
        <>
            <header className={styles.subpageHeader}>
                <button className={styles.backBtn} type="button" onClick={onBack} aria-label={t('common.back')}>
                    <HiChevronLeft size={22}/>
                </button>
                <div className={styles.subpageHeading}>
                    <h1>{title}</h1>
                </div>
            </header>
            {subtitle && (
                <section className={styles.subpageIntro}>
                    {icon && <span className={styles.subpageIntroIcon}>{icon}</span>}
                    <p>{subtitle}</p>
                </section>
            )}
        </>
    );
};

const Settings = () => {
    const {t, i18n} = useTranslation();
    const {user, profile, saveProfile, linkedAuthMethods, activeTab, setActiveTab, tabResetNonce} = useApp();
    const [view, setView] = useState<SettingsView>('home');
    const pageRef = useRef<HTMLDivElement>(null);
    const [editingProfile, setEditingProfile] = useState(false);
    const {
        categories,
        subcategories,
        addCategory,
        updateCategory,
        removeCategory,
        addSubcategory,
        updateSubcategory,
        removeSubcategory,
    } = useCategories(user?.uid ?? null);
    const {clearAll: clearAllTransactions} = useTransactions(user?.uid ?? null);
    const {budgets, setBudget, getBudget} = useBudgets(user?.uid ?? null);
    const {
        plannedExpenseVisibility,
        setPlannedExpenseVisibility,
        openTransactionOnLaunch,
        setOpenTransactionOnLaunch,
    } = useUserSettings(user?.uid ?? null);
    const {isPremium, isTrial, trialDaysLeft, aiUsed} = useEntitlements();
    const premiumGate = usePremiumGate();
    const {confirm, node: confirmNode} = useConfirm();

    const [catTab, setCatTab] = useState<'expense' | 'income'>('expense');
    const [expandedCat, setExpandedCat] = useState<string | null>(null);
    const [showAddCat, setShowAddCat] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [showAddSub, setShowAddSub] = useState<string | null>(null);
    const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
    const [catForm, setCatForm] = useState<NewCategory>(EMPTY_CAT());
    const [subName, setSubName] = useState('');
    const [saving, setSaving] = useState(false);

    const accountName = profile?.name?.trim()
        || user?.displayName?.trim()
        || user?.email
        || user?.phoneNumber
        || '';
    const accountInitial = accountName.trim().charAt(0).toUpperCase() || '#';
    // With no profile name set, accountName already falls back to the email, so
    // repeating it as the subtitle printed the same address twice.
    const rawContact = user?.phoneNumber ?? user?.email ?? '';
    const profileContact = rawContact && rawContact !== accountName
        ? rawContact
        : t('settings.personal_account');
    const setFormField = <K extends keyof NewCategory>(key: K, value: NewCategory[K]) =>
        setCatForm(form => ({...form, [key]: value}));

    const closeCategoryModal = () => {
        setShowAddCat(false);
        setEditingCategory(null);
        setCatForm(EMPTY_CAT());
    };

    const openEditCategory = (category: Category) => {
        setEditingCategory(category);
        setCatForm({
            name: getCategoryDisplayName(category),
            icon: category.icon,
            color: category.color,
            type: category.type,
        });
        setShowAddCat(true);
    };

    const handleSaveCategory = async () => {
        if (!catForm.name.trim()) return;
        if (!editingCategory && !isPremium) {
            premiumGate.open('categories');
            return;
        }
        setSaving(true);
        try {
            const data = {...catForm, name: catForm.name.trim()};
            if (editingCategory) await updateCategory(editingCategory.id, data);
            else await addCategory(data);
            closeCategoryModal();
        } finally {
            setSaving(false);
        }
    };

    const closeSubcategoryModal = () => {
        setShowAddSub(null);
        setEditingSubcategory(null);
        setSubName('');
    };

    const openEditSubcategory = (subcategory: Subcategory) => {
        setEditingSubcategory(subcategory);
        setShowAddSub(subcategory.categoryId);
        setSubName(subcategory.name);
    };

    const handleSaveSub = async (catId: string) => {
        if (!subName.trim()) return;
        if (!editingSubcategory && !isPremium) {
            premiumGate.open('categories');
            return;
        }
        setSaving(true);
        try {
            const data = {name: subName.trim(), categoryId: catId};
            if (editingSubcategory) await updateSubcategory(editingSubcategory.id, data);
            else await addSubcategory(data);
            closeSubcategoryModal();
        } finally {
            setSaving(false);
        }
    };

    const switchLanguage = (language: string) => {
        i18n.changeLanguage(language);
        localStorage.setItem('lang', language);
    };

    const filteredCats = categories.filter(category => category.type === catTab || category.type === 'both');
    const expenseCategories = categories.filter(category => category.type === 'expense' || category.type === 'both');
    const getSubs = (categoryId: string) => subcategories.filter(subcategory => subcategory.categoryId === categoryId);
    const getCategoryDisplayName = (category: { name: string; icon: string; type: CategoryType }) => {
        if (!isDefaultCategory(category)) return category.name;
        const key = DEFAULT_CATEGORY_KEYS[category.name];
        return key ? t(`settings.default_category_${key}`) : category.name;
    };
    const enabledWidgets = resolveHomeWidgets(profile?.homeWidgets).filter(widget => widget.enabled).length;
    const activeBudgets = budgets.filter(budget => budget.amount > 0).length;
    const currentLanguage = i18n.language === 'uz'
        ? t('settings.lang_uz')
        : i18n.language === 'ru'
            ? t('settings.lang_ru')
            : t('settings.lang_en');
    const plannedVisibilityText = t(`settings.planned_visibility_${plannedExpenseVisibility}`);
    const premiumUntil = profile?.subscription?.premiumUntil;
    const aiUsageLine = isPremium
        ? t('settings.sub_premium_active')
        : t('premium.ai_usage_banner', {used: aiUsed, limit: 10});

    useLayoutEffect(() => {
        if (pageRef.current) pageRef.current.scrollTop = 0;
    }, [view]);

    useLayoutEffect(() => {
        if (activeTab !== 'settings') setActiveTab('settings');
    }, [activeTab, setActiveTab]);

    // Tapping the Settings tab while already inside a subpage returns to the hub.
    const firstResetNonce = useRef(tabResetNonce);
    useLayoutEffect(() => {
        if (tabResetNonce === firstResetNonce.current) return;
        setView('home');
        setEditingProfile(false);
    }, [tabResetNonce]);

    if (editingProfile) {
        return (
            <div className={styles.profileEditor}>
                <Onboarding editing onDone={() => setEditingProfile(false)}/>
            </div>
        );
    }

    const renderPremiumCard = () => (
        <button
            type="button"
            className={`${styles.premiumCard} ${isPremium ? styles.premiumCardActive : ''}`}
            onClick={() => premiumGate.open('generic')}
        >
            <span className={styles.premiumIcon}><HiStar size={21}/></span>
            <span className={styles.premiumCopy}>
        <strong>
          {isPremium
              ? (isTrial ? t('settings.sub_premium_trial') : t('settings.sub_premium_title'))
              : t('settings.sub_free_title')}
        </strong>
        <small>
          {isPremium && isTrial && trialDaysLeft != null
              ? t('settings.sub_trial_days_left', {n: trialDaysLeft})
              : isPremium && premiumUntil
                  ? t('settings.sub_renews_on', {date: dayjs(premiumUntil).format('D MMM YYYY')})
                  : aiUsageLine}
        </small>
      </span>
            <span className={styles.premiumAction}>
        {isPremium ? t('settings.sub_manage_btn') : t('settings.sub_upgrade_btn')}
      </span>
        </button>
    );

    const renderHome = () => (
        <>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>Pulim</p>
                    <h1>{t('settings.title')}</h1>
                </div>
            </header>

            <div className={styles.homeTop}>
                <button className={styles.profileCard} type="button" onClick={() => setView('account')}>
                    <span className={styles.profileAvatar}>{accountInitial}</span>
                    <span className={styles.profileInfo}>
            <span className={styles.profileEmail}>{accountName}</span>
            {profileContact && <span className={styles.profileContact}>{profileContact}</span>}
          </span>
                    <HiChevronRight className={styles.menuChevron} size={18}/>
                </button>
                {renderPremiumCard()}
            </div>

            <section className={styles.menuSection}>
                <p className={styles.sectionLabel}>{t('settings.quick_settings')}</p>
                <div className={styles.menuGroup}>
                    <div className={styles.quickSettingRow}>
                        <span className={`${styles.menuIcon} ${styles.menuIconAccent}`}><HiPlus size={18}/></span>
                        <span className={styles.menuCopy}>
              <span className={styles.menuTitle}>{t('settings.auto_transaction_title')}</span>
              <span className={styles.menuSubtitle}>{t('settings.auto_transaction_hint')}</span>
            </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={openTransactionOnLaunch}
                            aria-label={t('settings.auto_transaction_title')}
                            className={`${styles.preferenceSwitch} ${openTransactionOnLaunch ? styles.preferenceSwitchOn : ''}`}
                            onClick={() => setOpenTransactionOnLaunch(!openTransactionOnLaunch)}
                        >
                            <span className={styles.preferenceThumb}/>
                        </button>
                    </div>
                    <MenuRow
                        icon={<HiLanguage size={19}/>}
                        title={t('settings.section_language')}
                        value={currentLanguage}
                        onClick={() => setView('language')}
                    />
                </div>
            </section>

            <section className={styles.menuSection}>
                <p className={styles.sectionLabel}>{t('settings.personalization')}</p>
                <div className={styles.menuGroup}>
                    <MenuRow
                        icon={<HiSquares2X2 size={19}/>}
                        title={t('settings.section_home_widgets')}
                        subtitle={t('settings.menu_home_widgets_desc')}
                        value={t('settings.enabled_count', {count: enabledWidgets})}
                        onClick={() => setView('widgets')}
                    />
                    <MenuRow
                        icon={<HiTag size={19}/>}
                        title={t('settings.section_categories')}
                        subtitle={t('settings.menu_categories_desc')}
                        value={String(categories.length)}
                        onClick={() => setView('categories')}
                    />
                    <MenuRow
                        icon={<HiWallet size={19}/>}
                        title={t('settings.section_budgets')}
                        subtitle={t('settings.menu_budgets_desc')}
                        value={t('settings.active_count', {count: activeBudgets})}
                        onClick={() => setView('budgets')}
                    />
                </div>
            </section>

            <section className={styles.menuSection}>
                <p className={styles.sectionLabel}>{t('settings.planning_group')}</p>
                <div className={styles.menuGroup}>
                    <MenuRow
                        icon={<HiCalendarDays size={19}/>}
                        title={t('settings.section_planned_expenses')}
                        subtitle={t('settings.menu_planning_desc')}
                        value={plannedVisibilityText}
                        onClick={() => setView('planning')}
                    />
                </div>
            </section>

            <section className={styles.menuSection}>
                <p className={styles.sectionLabel}>{t('settings.account_and_data')}</p>
                <div className={styles.menuGroup}>
                    <MenuRow
                        icon={<HiShieldCheck size={19}/>}
                        title={t('settings.account_security')}
                        subtitle={t('settings.menu_account_desc')}
                        value={t('settings.methods_count', {count: linkedAuthMethods.length})}
                        onClick={() => setView('account')}
                    />
                    <MenuRow
                        icon={<HiCircleStack size={19}/>}
                        title={t('settings.data_title')}
                        subtitle={t('settings.menu_data_desc')}
                        onClick={() => setView('data')}
                    />
                </div>
            </section>
        </>
    );

    const renderAccount = () => (
        <>
            <SubpageHeader
                title={t('settings.account_security')}
                subtitle={t('settings.account_page_hint')}
                icon={<HiShieldCheck size={25}/>}
                onBack={() => setView('home')}
            />
            <div className={styles.detailSection}>
                <div className={styles.accountSummary}>
                    <span className={styles.profileAvatar}>{accountInitial}</span>
                    <span className={styles.profileInfo}>
            <span className={styles.profileEmail}>{accountName}</span>
            {profileContact && <span className={styles.profileContact}>{profileContact}</span>}
          </span>
                </div>
            </div>

            <section className={styles.detailSection}>
                <p className={styles.sectionLabel}>{t('settings.connected_methods')}</p>
                <div className={styles.methodList}>
                    {linkedAuthMethods.length > 0 ? linkedAuthMethods.map(method => (
                        <div className={styles.methodRow} key={method}>
                            <span>{t(`auth.method_${method}`)}</span>
                            <span className={styles.connectedBadge}><HiCheck size={13}/>{t('settings.connected')}</span>
                        </div>
                    )) : (
                        <p className={styles.emptyText}>{t('settings.no_connected_methods')}</p>
                    )}
                </div>
            </section>

            <section className={styles.detailSection}>
                <button className={styles.signOutAction} type="button" onClick={() => signOut(auth)}>
                    <HiArrowRightOnRectangle size={18}/>{t('settings.btn_signout')}
                </button>
            </section>
        </>
    );

    const renderWidgets = () => (
        <>
            <SubpageHeader
                title={t('settings.section_home_widgets')}
                subtitle={t('settings.home_widgets_hint')}
                icon={<HiSquares2X2 size={25}/>}
                onBack={() => setView('home')}
            />
            <div className={styles.detailSection}>
                <HomeWidgetsSettings
                    value={profile?.homeWidgets ?? null}
                    onChange={(next: HomeWidgetSetting[]) => saveProfile({homeWidgets: next})}
                />
            </div>
        </>
    );

    const renderLanguage = () => (
        <>
            <SubpageHeader
                title={t('settings.section_language')}
                subtitle={t('settings.language_page_hint')}
                icon={<HiLanguage size={25}/>}
                onBack={() => setView('home')}
            />
            <div className={styles.detailSection}>
                <div className={styles.languageList}>
                    {(['uz', 'en', 'ru'] as const).map(language => (
                        <button
                            className={`${styles.languageRow} ${i18n.language === language ? styles.languageRowActive : ''}`}
                            type="button"
                            key={language}
                            onClick={() => switchLanguage(language)}
                        >
                            <span>{t(`settings.lang_${language}`)}</span>
                            {i18n.language === language && <HiCheck size={18}/>}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );

    const renderPlanning = () => (
        <>
            <SubpageHeader
                title={t('settings.section_planned_expenses')}
                subtitle={t('settings.planned_expenses_hint')}
                icon={<HiCalendarDays size={25}/>}
                onBack={() => setView('home')}
            />
            <div className={styles.detailSection}>
                <div className={styles.settingCard}>
                    <Select
                        label={t('settings.planned_visibility_label')}
                        value={plannedExpenseVisibility}
                        onChange={event => setPlannedExpenseVisibility(event.target.value as typeof plannedExpenseVisibility)}
                        options={[
                            {value: 'hidden', label: t('settings.planned_visibility_hidden')},
                            {value: '7d', label: t('settings.planned_visibility_7d')},
                            {value: '14d', label: t('settings.planned_visibility_14d')},
                            {value: 'this_month', label: t('settings.planned_visibility_this_month')},
                            {value: 'next_month', label: t('settings.planned_visibility_next_month')},
                        ]}
                    />
                </div>
            </div>
        </>
    );

    const renderCategoryItem = (category: Category) => {
        const subs = getSubs(category.id);
        const expanded = expandedCat === category.id;

        return (
            <div key={category.id} className={`${styles.catItem} ${expanded ? styles.catItemExpanded : ''}`}>
                <div className={styles.catRow} onClick={() => setExpandedCat(expanded ? null : category.id)}>
                    <div className={styles.catIconWrap} style={{background: category.color + '22'}}>
                        <span>{category.icon}</span>
                    </div>
                    <span className={styles.catName}>{getCategoryDisplayName(category)}</span>
                    {subs.length > 0 && <span className={styles.subCount}>{subs.length}</span>}
                    <div className={styles.catRowActions}>
                        <button className={styles.catEditBtn} type="button" aria-label={t('common.edit')}
                                onClick={event => {
                                    event.stopPropagation();
                                    openEditCategory(category);
                                }}>
                            <HiPencil size={14}/>
                        </button>
                        {expanded ? <HiChevronUp size={17} color="var(--text3)"/> :
                            <HiChevronDown size={17} color="var(--text3)"/>}
                    </div>
                </div>
                {expanded && (
                    <div className={styles.subSection}>
                        <div className={styles.subSectionHeader}>
                            <span>{t('settings.subcategories_title')}</span>
                            <button className={styles.addSubBtn} type="button"
                                    onClick={() => setShowAddSub(category.id)}>
                                <HiPlus size={13}/>{t('common.add')}
                            </button>
                        </div>
                        {subs.length === 0 && <p className={styles.subEmpty}>{t('settings.no_subcategories')}</p>}
                        {subs.map(subcategory => (
                            <div key={subcategory.id} className={styles.subItem}>
                                <span className={styles.subItemIcon}><HiTag size={13}/></span>
                                <span className={styles.subItemName}>{subcategory.name}</span>
                                <span className={styles.subItemActions}>
                  <button className={styles.subEditBtn} type="button" aria-label={t('common.edit')}
                          onClick={() => openEditSubcategory(subcategory)}>
                    <HiPencil size={13}/>
                  </button>
                  <button className={styles.subDeleteBtn} type="button" aria-label={t('common.delete')}
                          onClick={async () => {
                              const ok = await confirm({
                                  title: t('settings.confirm_delete_subcategory'),
                                  message: subcategory.name,
                                  confirmLabel: t('common.delete'),
                              });
                              if (ok) removeSubcategory(subcategory.id);
                          }}>
                    <HiTrash size={13}/>
                  </button>
                </span>
                            </div>
                        ))}
                        <button className={styles.deleteCategoryBtn} type="button" onClick={async () => {
                            const ok = await confirm({
                                title: t('settings.confirm_delete_category'),
                                message: `${category.icon} ${getCategoryDisplayName(category)}`,
                                detail: subs.length > 0 ? t('settings.confirm_delete_category_subs', {count: subs.length}) : undefined,
                                confirmLabel: t('common.delete'),
                            });
                            if (ok) removeCategory(category.id);
                        }}>
                            <HiTrash size={13}/>{t('settings.delete_category_action')}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    /**
     * One budget row. On the free plan the field is genuinely locked rather than
     * accepting input it will never save, and the paywall opens on interaction.
     */
    const renderBudgetRow = (budgetId: string, icon: string, label: string) => (
        <div className={styles.budgetItem} key={budgetId}>
            <span className={styles.budgetIcon} aria-hidden="true">{icon}</span>
            <span className={styles.budgetName}>{label}</span>
            <div className={styles.budgetInputWrap}>
                <BudgetInput
                    key={getBudget(budgetId)?.amount ?? budgetId}
                    className={`${styles.budgetInput} ${!isPremium ? styles.budgetInputLocked : ''}`}
                    placeholder="0"
                    aria-label={t('settings.budget_field_label', {category: label})}
                    initialValue={getBudget(budgetId)?.amount}
                    locked={!isPremium}
                    onLockedActivate={() => premiumGate.open('budgets')}
                    onSave={value => {
                        if (value >= 0) setBudget(budgetId, value, 'UZS');
                    }}
                />
                {!isPremium && <HiLockClosed className={styles.budgetLockIcon} size={13} aria-hidden="true"/>}
            </div>
            <span className={styles.budgetCurrency}>UZS</span>
        </div>
    );

    const renderBudgetCategory = (category: Category) =>
        renderBudgetRow(category.id, category.icon, getCategoryDisplayName(category));

    const renderCategories = () => (
        <>
            <SubpageHeader
                title={t('settings.section_categories')}
                subtitle={t('settings.categories_page_hint')}
                icon={<HiTag size={25}/>}
                onBack={() => setView('home')}
            />
            <section className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                    <p className={styles.inlinePremiumLabel}>
                        {catTab === 'expense' ? t('settings.tab_expense') : t('settings.tab_income')}
                        {!isPremium && <PremiumBadge/>}
                    </p>
                    <button
                        className={styles.smallAddBtn}
                        type="button"
                        onClick={() => isPremium ? setShowAddCat(true) : premiumGate.open('categories')}
                    >
                        {!isPremium ? <HiLockClosed size={12}/> : <HiPlus size={14}/>}{t('common.add')}
                    </button>
                </div>

                <div className={styles.catTypeTabs}>
                    <button className={`${styles.catTypeBtn} ${catTab === 'expense' ? styles.catTypeActive : ''}`}
                            onClick={() => setCatTab('expense')}>{t('settings.tab_expense')}</button>
                    <button className={`${styles.catTypeBtn} ${catTab === 'income' ? styles.catTypeActive : ''}`}
                            onClick={() => setCatTab('income')}>{t('settings.tab_income')}</button>
                </div>

                <div className={styles.catList}>
                    {filteredCats.length === 0 && (
                        <p className={styles.emptyText}>{catTab === 'expense' ? t('settings.no_expense_cats') : t('settings.no_income_cats')}</p>
                    )}
                    {filteredCats.map(renderCategoryItem)}
                </div>
            </section>
        </>
    );

    const renderBudgets = () => (
        <>
            <SubpageHeader
                title={t('settings.section_budgets')}
                subtitle={t('settings.budgets_page_hint')}
                icon={<HiWallet size={25}/>}
                onBack={() => setView('home')}
            />
            <section className={styles.detailSection}>
                {!isPremium &&
                    <div className={styles.premiumNotice}><PremiumBadge/>{t('settings.budgets_premium_hint')}</div>}

                <div className={styles.budgetList}>
                    {renderBudgetRow('__income__', '💰', t('settings.label_salary'))}
                    {renderBudgetRow('__debts__', '💳', t('settings.label_debt_payments'))}

                    {expenseCategories.map(renderBudgetCategory)}

                    {getBudget('__subscription__') && (getBudget('__subscription__')?.amount ?? 0) > 0 && (
                        <div className={`${styles.budgetItem} ${styles.budgetAutoItem}`}>
                            <span className={styles.budgetIcon}>📡</span>
                            <span className={styles.budgetName}>{t('settings.label_subscriptions')}</span>
                            <span
                                className={styles.budgetAutoValue}>{formatAmount(getBudget('__subscription__')?.amount ?? 0)}</span>
                            <span className={styles.budgetCurrency}>UZS</span>
                        </div>
                    )}
                </div>
            </section>
        </>
    );

    const renderData = () => (
        <>
            <SubpageHeader
                title={t('settings.data_title')}
                subtitle={t('settings.data_page_hint')}
                icon={<HiCircleStack size={25}/>}
                onBack={() => setView('home')}
            />
            <section className={styles.detailSection}>
                <div className={styles.dangerCard}>
                    <div className={styles.dangerCopy}>
                        <HiExclamationTriangle size={20}/>
                        <div>
                            <strong>{t('settings.btn_clear_transactions')}</strong>
                            <p>{t('settings.clear_transactions_hint')}</p>
                        </div>
                    </div>
                    <button
                        className={styles.dangerBtn}
                        type="button"
                        onClick={async () => {
                            const ok = await confirm({
                                title: t('settings.btn_clear_transactions'),
                                message: t('settings.confirm_clear_transactions'),
                                warning: t('common.action_irreversible'),
                                confirmLabel: t('settings.btn_clear_transactions'),
                            });
                            if (!ok) return;
                            await clearAllTransactions();
                        }}
                    >
                        <HiTrash size={16}/>{t('settings.btn_clear_transactions')}
                    </button>
                </div>
            </section>
        </>
    );

    const categoryTypeLabel = catForm.type === 'expense'
        ? t('settings.type_expense')
        : catForm.type === 'income'
            ? t('settings.type_income')
            : t('settings.type_both');
    const subcategoryParent = categories.find(category => category.id === showAddSub);

    const content: Record<SettingsView, () => ReactNode> = {
        home: renderHome,
        account: renderAccount,
        widgets: renderWidgets,
        language: renderLanguage,
        planning: renderPlanning,
        categories: renderCategories,
        budgets: renderBudgets,
        data: renderData,
    };

    return (
        <div className={styles.page} ref={pageRef}>
            <div className={styles.pageContent} key={view}>{content[view]()}</div>

            {showAddCat && (
                <Modal
                    title={t(editingCategory ? 'settings.modal_edit_category' : 'settings.modal_new_category')}
                    onClose={closeCategoryModal}
                    footer={
                        <button className={`${styles.saveBtn} ${saving || !catForm.name.trim() ? styles.disabled : ''}`}
                                onClick={handleSaveCategory} disabled={saving || !catForm.name.trim()}>
                            {saving ? t('common.saving') : t(editingCategory ? 'settings.btn_save_category' : 'settings.btn_add_category')}
                        </button>
                    }
                >
                    <div className={styles.categoryForm}>
                        <div className={styles.categoryPreview}
                             style={{background: `${catForm.color}16`, borderColor: `${catForm.color}55`}}>
                            <span className={styles.categoryPreviewIcon}
                                  style={{background: `${catForm.color}2b`}}>{catForm.icon}</span>
                            <span className={styles.categoryPreviewCopy}>
                <small>{t('settings.category_preview_label')}</small>
                <strong>{catForm.name.trim() || t('settings.category_preview_placeholder')}</strong>
                <span>{categoryTypeLabel}</span>
              </span>
                        </div>

                        <div className={styles.formCard}>
                            <Input
                                autoFocus
                                label={t('common.name')}
                                placeholder={t('settings.category_name_placeholder')}
                                value={catForm.name}
                                onChange={event => setFormField('name', event.target.value)}
                            />
                            <div>
                                <p className={styles.pickLabel}>{t('common.type')}</p>
                                <div className={styles.typePicker}>
                                    {(['expense', 'income', 'both'] as const).map(type => (
                                        <button
                                            type="button"
                                            key={type}
                                            aria-pressed={catForm.type === type}
                                            className={`${styles.typePickerBtn} ${catForm.type === type ? styles.typePickerActive : ''}`}
                                            onClick={() => setFormField('type', type)}
                                        >
                                            {t(`settings.type_${type}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <EmojiInput
                                label={t('settings.icon_label')}
                                value={catForm.icon}
                                onChange={icon => setFormField('icon', icon)}
                                suggestions={ICON_SUGGESTIONS}
                                placeholder={t('settings.emoji_placeholder')}
                                compactSuggestions
                            />
                            <div>
                                <p className={styles.pickLabel}>{t('settings.color_label')}</p>
                                <div className={styles.colorRow}>
                                    {COLORS.map(color => (
                                        <button
                                            type="button"
                                            key={color}
                                            className={`${styles.colorBtn} ${catForm.color === color ? styles.colorActive : ''}`}
                                            style={{background: color}}
                                            onClick={() => setFormField('color', color)}
                                            aria-label={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {showAddSub && (
                <Modal
                    title={t(editingSubcategory ? 'settings.modal_edit_subcategory' : 'settings.modal_new_subcategory')}
                    onClose={closeSubcategoryModal}
                    footer={
                        <button className={`${styles.saveBtn} ${saving || !subName.trim() ? styles.disabled : ''}`}
                                onClick={() => handleSaveSub(showAddSub)} disabled={saving || !subName.trim()}>
                            {saving ? t('common.saving') : t(editingSubcategory ? 'settings.btn_save_subcategory' : 'settings.btn_add_subcategory_save')}
                        </button>
                    }
                >
                    <div className={styles.subcategoryForm}>
                        {subcategoryParent && (
                            <div className={styles.parentCategoryCard}
                                 style={{borderColor: `${subcategoryParent.color}55`}}>
                                <span className={styles.parentCategoryIcon}
                                      style={{background: `${subcategoryParent.color}22`}}>{subcategoryParent.icon}</span>
                                <span className={styles.parentCategoryCopy}>
                  <small>{t('settings.subcategory_parent_label')}</small>
                  <strong>{getCategoryDisplayName(subcategoryParent)}</strong>
                </span>
                                <HiChevronRight size={18}/>
                            </div>
                        )}
                        <div className={styles.formCard}>
                            <Input
                                autoFocus
                                label={t('settings.subcategory_name_label')}
                                placeholder={t('settings.subcategory_name_placeholder')}
                                value={subName}
                                onChange={event => setSubName(event.target.value)}
                            />
                            <p className={styles.formHint}>{t('settings.subcategory_form_hint')}</p>
                        </div>
                    </div>
                </Modal>
            )}

            {premiumGate.node}

            {confirmNode}
        </div>
    );
};

export default Settings;
