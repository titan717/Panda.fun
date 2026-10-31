import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** Keeps keyboard focus inside an active modal and restores the opener on close. */
export function useModalFocusTrap<T extends HTMLElement>(
  dialogRef: RefObject<T | null>,
  onClose: () => void,
  active = true,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(element =>
        element.tabIndex >= 0 &&
        !element.matches(':disabled,[aria-disabled="true"]') &&
        !element.closest('[hidden],[aria-hidden="true"],[inert]') &&
        element.getClientRects().length > 0
      );

    (getFocusable()[0] || dialog).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialog.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [active, dialogRef]);
}
