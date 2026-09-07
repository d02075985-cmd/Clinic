import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    (destructive ? cancelRef.current : confirmRef.current)?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, destructive, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (!destructive && event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="ui-card w-full max-w-sm p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className={`mb-2 font-bold ${destructive ? 'text-[#C4362B]' : 'text-[#102F63]'}`}>
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mb-5 text-sm text-[#64748B]">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-[10px] border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={destructive ? 'btn-danger-outline px-4 py-2 text-sm' : 'btn-primary px-4 py-2 text-sm'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
