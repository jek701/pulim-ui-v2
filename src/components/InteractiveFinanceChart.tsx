import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';
import { motion } from 'framer-motion';
import { HiArrowPath } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import type { Currency } from '../types';
import { formatAmount } from '../utils/format';
import styles from './InteractiveFinanceChart.module.css';

export type FinanceChartType = 'pie' | 'line';
export type FinanceChartView = 'expense' | 'income' | 'both';

export interface FinancePieDatum {
  name: string;
  value: number;
  color: string;
  icon: string;
  categoryId: string;
  childrenLabel?: string;
  children?: Array<{ id: string; name: string; value: number; icon?: string }>;
}

export interface FinanceLineDatum {
  day: number;
  income: number;
  expense: number;
}

interface Props {
  type: FinanceChartType;
  view: FinanceChartView;
  currency: Currency;
  pieData: FinancePieDatum[];
  lineData: FinanceLineDatum[];
  monthShort: string;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  emptyLabel: string;
  tourTarget?: boolean;
}

const formatCompact = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
};

const PIE_START_ANGLE = 90;
const PIE_END_ANGLE = -270;
const PIE_PADDING_ANGLE = 3;

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
const clockwiseDistance = (from: number, to: number) => normalizeAngle(from - to);
const shortestAngleDistance = (first: number, second: number) => {
  const distance = Math.abs(normalizeAngle(first) - normalizeAngle(second));
  return Math.min(distance, 360 - distance);
};

const InteractiveFinanceChart = ({
  type,
  view,
  currency,
  pieData,
  lineData,
  monthShort,
  selectedCategoryId,
  onSelectCategory,
  emptyLabel,
  tourTarget = false,
}: Props) => {
  const { t, i18n } = useTranslation();
  const isScrubbingPie = useRef(false);
  const selectedItem = pieData.find(item => item.categoryId === selectedCategoryId) ?? null;
  const activeCategoryId = selectedItem?.categoryId ?? null;
  const total = useMemo(() => pieData.reduce((sum, item) => sum + item.value, 0), [pieData]);
  const hasLineData = lineData.some(item => item.income > 0 || item.expense > 0);
  const incomeVisible = view !== 'expense';
  const expenseVisible = view !== 'income';
  const centerLabel = selectedItem?.name ?? (
    view === 'expense'
      ? t('charts.label_expenses')
      : view === 'income'
        ? t('charts.label_income')
        : t('charts.turnover')
  );
  const centerValue = selectedItem?.value ?? total;
  const centerAmount = `${new Intl.NumberFormat(i18n.language, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(centerValue)} ${currency}`;
  const pieHitSectors = useMemo(() => {
    const positiveItems = pieData.filter(item => item.value > 0);
    const positiveTotal = positiveItems.reduce((sum, item) => sum + item.value, 0);
    if (positiveTotal <= 0) return [];

    const drawableAngle = 360 - positiveItems.length * PIE_PADDING_ANGLE;
    let startAngle = PIE_START_ANGLE;

    return positiveItems.map(item => {
      const sectorAngle = (item.value / positiveTotal) * drawableAngle;
      const endAngle = startAngle - sectorAngle;
      const sector = {
        categoryId: item.categoryId,
        startAngle,
        endAngle,
        midAngle: startAngle - sectorAngle / 2,
      };
      startAngle = endAngle - PIE_PADDING_ANGLE;
      return sector;
    });
  }, [pieData]);

  const selectPieSectorAtPointer = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (pieHitSectors.length === 0) return;
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;

    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const pointerAngle = normalizeAngle(Math.atan2(-dy, dx) * 180 / Math.PI);
    const exactSector = pieHitSectors.find(sector => (
      clockwiseDistance(sector.startAngle, pointerAngle)
      <= clockwiseDistance(sector.startAngle, sector.endAngle)
    ));
    const closestSector = exactSector ?? pieHitSectors.reduce((closest, sector) => (
      shortestAngleDistance(pointerAngle, sector.midAngle)
        < shortestAngleDistance(pointerAngle, closest.midAngle)
        ? sector
        : closest
    ));

    if (closestSector.categoryId !== activeCategoryId) {
      onSelectCategory(closestSector.categoryId);
    }
  };

  const handlePiePointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    isScrubbingPie.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    selectPieSectorAtPointer(event);
  };

  const handlePiePointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (isScrubbingPie.current) selectPieSectorAtPointer(event);
  };

  const stopPieScrubbing = (event: ReactPointerEvent<SVGCircleElement>) => {
    isScrubbingPie.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (type === 'pie' && pieData.length === 0) {
    return <div className={styles.empty}>{emptyLabel}</div>;
  }
  if (type === 'line' && !hasLineData) {
    return <div className={styles.empty}>{emptyLabel}</div>;
  }

  return (
    <div className={styles.card}>
      {type === 'pie' ? (
        <>
          <div className={styles.pieStage} data-history-tour={tourTarget ? 'chart' : undefined}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart className={styles.rechart}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={76}
                  outerRadius={108}
                  startAngle={PIE_START_ANGLE}
                  endAngle={PIE_END_ANGLE}
                  paddingAngle={PIE_PADDING_ANGLE}
                  cornerRadius={7}
                  dataKey="value"
                  stroke="transparent"
                  animationDuration={650}
                  shape={(sectorProps: PieSectorShapeProps, index: number) => {
                    const item = pieData[index];
                    const isActive = item?.categoryId === activeCategoryId;
                    const hasSelection = activeCategoryId !== null;
                    return (
                      <motion.g
                        style={{
                          transformOrigin: `${sectorProps.cx}px ${sectorProps.cy}px`,
                          transformBox: 'view-box',
                        }}
                        initial={false}
                        animate={{
                          scale: !hasSelection ? 1 : isActive ? 1.055 : 0.965,
                          opacity: !hasSelection || isActive ? 1 : 0.24,
                        }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <Sector {...sectorProps} />
                      </motion.g>
                    );
                  }}
                >
                  {pieData.map(item => (
                    <Cell
                      key={item.categoryId}
                      fill={item.color}
                      className={styles.pieCell}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <svg className={styles.pieTouchLayer} viewBox="0 0 300 260" aria-hidden="true">
              <rect
                width="300"
                height="260"
                onPointerDown={() => onSelectCategory(null)}
              />
              <circle
                cx="150"
                cy="130"
                r="94"
                pathLength="1"
                onPointerDown={handlePiePointerDown}
                onPointerMove={handlePiePointerMove}
                onPointerUp={stopPieScrubbing}
                onPointerCancel={stopPieScrubbing}
              />
            </svg>
            <button
              type="button"
              className={styles.pieCenter}
              onClick={() => onSelectCategory(null)}
              aria-label={selectedItem ? t('charts.clear_filter') : centerLabel}
            >
              <span className={view === 'income' ? styles.centerIncome : styles.centerExpense}>
                {selectedItem?.icon ?? (view === 'income' ? '+' : view === 'expense' ? '−' : '↕')}
              </span>
              <small>{centerLabel}</small>
              <strong title={formatAmount(centerValue, currency)}>{centerAmount}</strong>
              {selectedItem && <em><HiArrowPath size={11} /> {t('charts.reset')}</em>}
            </button>
          </div>

          {selectedItem?.children && selectedItem.children.length > 0 && (
            <section className={styles.drilldown}>
              <div className={styles.drilldownHeader}>
                <div>
                  <span>{selectedItem.icon}</span>
                  <div><strong>{selectedItem.name}</strong><small>{selectedItem.childrenLabel ?? t('charts.debt_breakdown_hint')}</small></div>
                </div>
                <b>{formatAmount(selectedItem.value, currency)}</b>
              </div>
              <div className={styles.drilldownList}>
                {selectedItem.children.map(child => (
                  <div key={child.id}>
                    <span>{child.icon ?? '💳'}</span>
                    <p>{child.name}</p>
                    <strong>{formatAmount(child.value, currency)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.pieBreakdown}>
            <div className={styles.pieBreakdownHeader}>
              <div>
                <h3>{t(`charts.breakdown_${view === 'expense' ? 'expenses' : view === 'income' ? 'income' : 'all'}`)}</h3>
                <p>{t('charts.tap_category_hint')}</p>
              </div>
              <span>{pieData.length}</span>
            </div>
            <div className={styles.pieBreakdownList}>
              {pieData.map(item => {
                const isSelected = activeCategoryId === item.categoryId;
                return (
                  <button
                    type="button"
                    key={item.categoryId}
                    className={isSelected ? styles.pieBreakdownItemActive : ''}
                    onClick={() => onSelectCategory(isSelected ? null : item.categoryId)}
                  >
                    <span className={styles.pieBreakdownIcon} style={{ background: `${item.color}1F`, color: item.color }}>
                      {item.icon}
                    </span>
                    <span className={styles.pieBreakdownName}>
                      <strong>{item.name}</strong>
                      {item.children?.length ? <small>{t('charts.items_count', { count: item.children.length })}</small> : null}
                    </span>
                    <b>{formatAmount(item.value, currency)}</b>
                    <i style={{ background: item.color }} />
                  </button>
                );
              })}
            </div>
          </section>

        </>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={lineData} margin={{ top: 14, right: 12, left: -8, bottom: 2 }} className={styles.rechart}>
              <defs>
                <linearGradient id="incomeLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22C55E" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
                <linearGradient id="expenseLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F43F5E" />
                  <stop offset="100%" stopColor="#FB7185" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 7" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                interval={4}
                tick={{ fontSize: 10, fill: 'var(--text3)' }}
                tickFormatter={day => `${day} ${monthShort}`}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={47}
                tick={{ fontSize: 10, fill: 'var(--text3)' }}
                tickFormatter={formatCompact}
              />
              <Tooltip
                cursor={{ stroke: 'var(--accent2)', strokeWidth: 1, strokeDasharray: '3 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className={styles.lineTooltip}>
                      <small>{label} {monthShort}</small>
                      {payload.map(entry => (
                        <div key={String(entry.dataKey)}>
                          <span style={{ background: entry.color }} />
                          <p>{entry.dataKey === 'income' ? t('charts.label_income') : t('charts.label_expenses')}</p>
                          <strong>{formatAmount(Number(entry.value ?? 0), currency)}</strong>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {incomeVisible && (
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="url(#incomeLine)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--surface)', fill: '#22C55E' }}
                  animationDuration={600}
                />
              )}
              {expenseVisible && (
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="url(#expenseLine)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--surface)', fill: '#F43F5E' }}
                  animationDuration={600}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

export default InteractiveFinanceChart;
