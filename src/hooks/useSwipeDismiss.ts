import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEventHandler } from 'react';

const DISMISS_DISTANCE = 72;

const findScrollableParent = (target: EventTarget | null, boundary: HTMLElement) => {
  let element = target instanceof HTMLElement ? target : null;
  while (element) {
    const { overflowY } = window.getComputedStyle(element);
    if (
      element.scrollHeight > element.clientHeight + 1
      && (overflowY === 'auto' || overflowY === 'scroll')
    ) return element;
    if (element === boundary) break;
    element = element.parentElement;
  }
  return null;
};

export const useSwipeDismiss = (onDismiss: () => void) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  // Held in state (not just a ref) so the touch listeners attach when the sheet node
  // mounts later than the hook — e.g. a panel rendered conditionally by its page.
  const [element, setElement] = useState<HTMLElement | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  const gestureRef = useRef<{
    startY: number;
    startX: number;
    handoffY: number | null;
    scrollable: HTMLElement | null;
    committed: boolean;
    pointerId?: number;
  } | null>(null);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const beginGesture = useCallback((x: number, y: number, target: EventTarget | null, pointerId?: number) => {
    const boundary = elementRef.current;
    if (!boundary) return;
    const scrollable = findScrollableParent(target, boundary);
    gestureRef.current = {
      startY: y,
      startX: x,
      handoffY: scrollable && scrollable.scrollTop > 0 ? null : y,
      scrollable,
      committed: false,
      pointerId,
    };
  }, []);

  const moveGesture = useCallback((x: number, y: number, preventDefault: () => void) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const totalY = y - gesture.startY;
    const totalX = Math.abs(x - gesture.startX);

    if (totalY < -12 || (totalX > Math.abs(totalY) && totalX > 14)) {
      gestureRef.current = null;
      setIsDragging(false);
      setDragY(0);
      return;
    }
    if (totalY <= 0) return;

    if (gesture.handoffY === null) {
      if (gesture.scrollable && gesture.scrollable.scrollTop > 0) return;
      gesture.handoffY = y;
    }

    const sheetDistance = Math.max(0, y - gesture.handoffY);
    if (sheetDistance <= 0) return;
    preventDefault();
    gesture.committed ||= sheetDistance >= DISMISS_DISTANCE;
    setHasInteracted(true);
    setIsDragging(true);
    setDragY(sheetDistance);
  }, []);

  const finishGesture = useCallback((y: number) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const sheetDistance = gesture.handoffY === null ? 0 : Math.max(0, y - gesture.handoffY);
    const shouldDismiss = gesture.committed || sheetDistance >= DISMISS_DISTANCE;
    gestureRef.current = null;
    setIsDragging(false);

    if (shouldDismiss) {
      onDismissRef.current();
      return;
    }
    setDragY(0);
  }, []);

  const cancelGesture = useCallback(() => {
    gestureRef.current = null;
    setIsDragging(false);
    setDragY(0);
  }, []);

  const swipeRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
    setElement(node);
    if (!node) {
      // The hook can outlive its sheet; start the next opening from rest, not from
      // wherever the dismissing drag left it.
      gestureRef.current = null;
      setIsDragging(false);
      setDragY(0);
      setHasInteracted(false);
    }
  }, []);

  useEffect(() => {
    if (!element) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      beginGesture(touch.clientX, touch.clientY, event.target);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      moveGesture(touch.clientX, touch.clientY, () => event.preventDefault());
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (touch) finishGesture(touch.clientY);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', cancelGesture, { passive: true });
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', cancelGesture);
    };
  }, [element, beginGesture, cancelGesture, finishGesture, moveGesture]);

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
    beginGesture(event.clientX, event.clientY, event.target, event.pointerId);
  }, [beginGesture]);

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    // Capture only once the pointer actually drags: capturing on pointerdown
    // retargets the click to the sheet, so no button inside it could be pressed.
    if (
      Math.abs(event.clientY - gesture.startY) > 4
      && !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    moveGesture(event.clientX, event.clientY, () => event.preventDefault());
  }, [moveGesture]);

  const onPointerUp = useCallback<PointerEventHandler<HTMLElement>>((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    finishGesture(event.clientY);
  }, [finishGesture]);

  const swipeAreaProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancelGesture,
  };

  const swipeStyle: CSSProperties | undefined = hasInteracted ? {
    transform: `translate3d(0, ${dragY}px, 0)`,
    transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: 'transform',
  } : undefined;

  return { swipeRef, swipeAreaProps, swipeStyle, isDragging };
};
