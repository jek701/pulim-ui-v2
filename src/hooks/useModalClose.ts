import { useCallback, useEffect, useRef, useState } from 'react';

export const useModalClose = (onClose: () => void, duration = 240) => {
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timerRef.current = window.setTimeout(() => onCloseRef.current(), reducedMotion ? 0 : duration);
  }, [duration]);

  const resetClose = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    closingRef.current = false;
    setIsClosing(false);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { isClosing, requestClose, resetClose };
};
