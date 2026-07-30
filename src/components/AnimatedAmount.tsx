import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { formatAmount } from '../utils/format';
import type { Currency } from '../types';

/** Money value that counts up from 0 on mount and springs between value changes. */
export const AnimatedAmount = ({ value, currency, className }: {
  value: number;
  currency: Currency;
  className?: string;
}) => {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      prevRef.current = value;
      return;
    }
    const precision = Number.isInteger(value) ? 1 : 100;
    const controls = animate(prevRef.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(Math.round(v * precision) / precision),
    });
    prevRef.current = value;
    return () => controls.stop();
  }, [value, reduceMotion]);

  const shown = reduceMotion ? value : display;
  return <span className={className}>{formatAmount(shown, currency)}</span>;
};

export default AnimatedAmount;
