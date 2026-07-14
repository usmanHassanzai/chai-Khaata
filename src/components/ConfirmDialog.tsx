import { useEffect } from 'react';
import { Label } from '../i18n/useLabel';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className={`confirm-dialog${danger ? ' confirm-dialog-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-icon">{danger ? '⚠️' : '❓'}</div>
        <h3 id="confirm-title" className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelLabel ?? <Label k="common.cancel" variant="compact" />}
          </button>
          <button
            type="button"
            className={`btn${danger ? ' btn-danger' : ' primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? <Label k="common.yes" variant="compact" />}
          </button>
        </div>
      </div>
    </div>
  );
}
