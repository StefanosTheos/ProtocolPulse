'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

// Modal used for every human sign-off (approval, case transition, disposition, participation,
// simulated record). The caller owns validation; `confirmDisabled` blocks submission until the
// human has supplied what the contract requires.
export function ConfirmReviewDialog({
  open, title, children, confirmLabel, onConfirm, onCancel, confirmDisabled, busy, tone = 'primary',
}: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; confirmDisabled?: boolean; busy?: boolean; tone?: 'primary' | 'secondary';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; keep the latest in refs so focus is set only when the dialog opens.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>('textarea, input, select, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busyRef.current) cancelRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="card w-full max-w-lg shadow-lg">
        <div className="border-b border-line px-4 py-3"><h2 id={titleId}>{title}</h2></div>
        <div className="space-y-3 px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={tone === 'primary' ? 'btn-primary' : 'btn-secondary'} onClick={onConfirm} disabled={confirmDisabled || busy}>
            {busy ? 'Submitting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
