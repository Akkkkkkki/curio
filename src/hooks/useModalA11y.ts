import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseModalA11yOptions {
  /**
   * Element to receive initial focus instead of the first focusable child.
   * Use this on confirm-style modals (e.g. delete) so focus lands on the
   * safe action, not the destructive primary.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Modal accessibility primitive: Escape-to-close, focus trap inside the
 * dialog, initial focus, and focus restore on dismiss. Mirrors the pattern
 * in AuthModal/AddItemModal so all dialogs feel the same to keyboard and
 * screen-reader users.
 */
export function useModalA11y(
  dialogRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  options: UseModalA11yOptions = {},
): void {
  const { initialFocusRef } = options;
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  // Inline onClose handlers from parents change identity every render. Holding
  // the latest in a ref lets the focus-trap effect depend only on `isOpen`,
  // so parent rerenders don't tear down listeners or steal focus back.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const focusTarget = initialFocusRef?.current;
    const dialog = dialogRef.current;
    const frameId = requestAnimationFrame(() => {
      if (focusTarget) {
        focusTarget.focus();
        return;
      }
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    });

    const getFocusable = () => {
      const el = dialogRef.current;
      if (!el) return [] as HTMLElement[];
      return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (n) => n.offsetParent !== null,
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isInside = active ? focusable.includes(active) : false;

      if (!isInside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', onKeyDown);
      lastFocusedElementRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
