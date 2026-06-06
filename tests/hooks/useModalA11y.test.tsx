import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React, { useRef } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

function Harness({
  isOpen,
  onClose,
  useInitialFocus = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  useInitialFocus?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalA11y(dialogRef, isOpen, onClose, {
    initialFocusRef: useInitialFocus ? cancelRef : undefined,
  });

  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" data-testid="dialog">
      <button data-testid="first">first</button>
      <button ref={cancelRef} data-testid="cancel">
        cancel
      </button>
      <button data-testid="confirm">confirm</button>
    </div>
  );
}

describe('useModalA11y', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('does not bind Escape when closed', () => {
    const onClose = vi.fn();
    render(<Harness isOpen={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape when open', () => {
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the first focusable element by default', async () => {
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} />);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('focuses initialFocusRef when provided (safe action on confirm modals)', async () => {
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} useInitialFocus />);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(screen.getByTestId('cancel'));
  });

  it('wraps focus from last to first on Tab', () => {
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} />);

    const last = screen.getByTestId('confirm');
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByTestId('first'));
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const onClose = vi.fn();
    render(<Harness isOpen={true} onClose={onClose} />);

    const first = screen.getByTestId('first');
    first.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(screen.getByTestId('confirm'));
  });
});
