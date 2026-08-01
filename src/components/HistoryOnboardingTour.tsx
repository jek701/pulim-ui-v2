import {useMemo} from 'react';
import {EVENTS, Joyride, STATUS} from 'react-joyride';
import type {EventData, Step} from 'react-joyride';
import {useTranslation} from 'react-i18next';

interface HistoryOnboardingTourProps {
    run: boolean;
    onPrepareStep: (stage: number) => void;
    onFinish: () => void;
}

const waitForPaint = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

const HistoryOnboardingTour = ({run, onPrepareStep, onFinish}: HistoryOnboardingTourProps) => {
    const {t} = useTranslation();

    const steps = useMemo<Step[]>(() => {
        const makeBefore = (stage: number) => async () => {
            onPrepareStep(stage);
            await waitForPaint();
        };

        return [
            {
                target: '[data-history-tour="summary"]',
                title: t('transactions.history_tour_summary_title'),
                content: t('transactions.history_tour_summary_text'),
                placement: 'bottom',
                before: makeBefore(0),
            },
            {
                target: '[data-history-tour="views"]',
                title: t('transactions.history_tour_views_title'),
                content: t('transactions.history_tour_views_text'),
                placement: 'bottom',
                before: makeBefore(1),
            },
            {
                target: '[data-history-tour="chart"]',
                title: t('transactions.history_tour_chart_title'),
                content: t('transactions.history_tour_chart_text'),
                placement: 'top',
                before: makeBefore(2),
            },
            {
                target: '[data-history-tour="list"]',
                title: t('transactions.history_tour_list_title'),
                content: t('transactions.history_tour_list_text'),
                placement: 'top',
                before: makeBefore(3),
            },
            {
                target: '[data-history-tour="filter-button"]',
                title: t('transactions.history_tour_filter_title'),
                content: t('transactions.history_tour_filter_text'),
                placement: 'bottom-end',
                before: makeBefore(4),
            },
            {
                target: '[data-filter-tour="types"]',
                title: t('transactions.filter_tour_type_title'),
                content: t('transactions.filter_tour_type_text'),
                placement: 'bottom',
                before: makeBefore(5),
            },
            {
                target: '[data-filter-tour="categories"]',
                title: t('transactions.filter_tour_category_title'),
                content: t('transactions.filter_tour_category_text'),
                placement: 'top',
                before: makeBefore(6),
            },
            {
                target: '[data-filter-tour="accounts"]',
                title: t('transactions.filter_tour_account_title'),
                content: t('transactions.filter_tour_account_text'),
                placement: 'top',
                before: makeBefore(7),
            },
            {
                target: '[data-filter-tour="dates"]',
                title: t('transactions.filter_tour_date_title'),
                content: t('transactions.filter_tour_date_text'),
                placement: 'top',
                before: makeBefore(8),
            },
            {
                target: '[data-filter-tour="result"]',
                title: t('transactions.filter_tour_result_title'),
                content: t('transactions.history_tour_result_text'),
                placement: 'top',
                before: makeBefore(9),
            },
        ];
    }, [onPrepareStep, t]);

    const handleEvent = (event: EventData) => {
        if (event.type === EVENTS.TOUR_END
            || event.status === STATUS.FINISHED
            || event.status === STATUS.SKIPPED) {
            onFinish();
        }
    };

    return (
        <Joyride
            run={run}
            steps={steps}
            continuous
            scrollToFirstStep
            onEvent={handleEvent}
            locale={{
                back: t('transactions.filter_tour_back'),
                last: t('transactions.filter_tour_done'),
                next: t('transactions.filter_tour_next'),
                nextWithProgress: t('transactions.filter_tour_next_progress'),
                skip: t('transactions.filter_tour_skip'),
            }}
            options={{
                buttons: ['skip', 'back', 'primary'],
                blockTargetInteraction: true,
                closeButtonAction: 'skip',
                dismissKeyAction: false,
                overlayClickAction: false,
                overlayColor: 'rgba(8, 8, 12, 0.66)',
                primaryColor: '#7c3aed',
                backgroundColor: 'var(--surface, #ffffff)',
                textColor: 'var(--text1, #111116)',
                arrowColor: 'var(--surface, #ffffff)',
                showProgress: true,
                skipBeacon: true,
                spotlightPadding: 6,
                spotlightRadius: 14,
                scrollOffset: 18,
                width: 'min(340px, calc(100vw - 32px))',
                zIndex: 700,
            }}
            styles={{
                tooltip: {
                    borderRadius: 18,
                    padding: 16,
                    boxShadow: '0 18px 55px rgba(0, 0, 0, 0.28)',
                },
                tooltipContainer: {textAlign: 'left'},
                tooltipTitle: {fontSize: 17, lineHeight: 1.25, fontWeight: 750},
                tooltipContent: {fontSize: 14, lineHeight: 1.45, padding: '8px 0 14px'},
                buttonPrimary: {borderRadius: 11, minHeight: 38, padding: '8px 15px', fontWeight: 700},
                buttonBack: {fontWeight: 650},
                buttonSkip: {opacity: 0.65, paddingLeft: 0},
            }}
        />
    );
};

export default HistoryOnboardingTour;
