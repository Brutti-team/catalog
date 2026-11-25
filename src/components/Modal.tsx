import { useEffect, useRef, type ReactNode } from "react";
import { X, AlertCircle } from "lucide-react";
export default function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = "",
  eyebrow = "BRUTTI WORKSPACE",
  description,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  eyebrow?: string;
  description?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    el?.showModal();
    return () => {
      el?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <header className="modal-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p className="modal-description">{description}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}


/** In-app confirmation; uses the same glass dialog as publishing actions. */
export function EditorConfirmation({title, description, confirmLabel, onCancel, onConfirm}: {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} eyebrow="BRUTTI CATALOG / CONFIRM ACTION"
      className="catalog-publish-confirm-dialog" onClose={onCancel}>
      <div className="catalog-publish-confirm-body">
        <div className="catalog-publish-confirm-intro">
          <div className="catalog-publish-confirm-icon is-draft">
            <AlertCircle size={21} strokeWidth={1.8} aria-hidden="true"/>
          </div>
          <p className="catalog-publish-confirm-description">{description}</p>
        </div>
        <div className="catalog-publish-confirm-actions">
          <button type="button" className="catalog-publish-confirm-cancel" autoFocus onClick={onCancel}>Cancel</button>
          <button type="button" className="catalog-publish-confirm-submit is-draft" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
