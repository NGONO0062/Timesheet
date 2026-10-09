"use client";
// Modal et Offcanvas ODS. Voile noir à 50 % : la seule transparence de l'application.
import { useId, type FormEventHandler, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { dict } from "@/lib/i18n";
import { Icon } from "./Icon";
import { useDialog } from "./useDialog";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Rendu dans le flux (planches de /design) plutôt que dans un portail. */
  inline?: boolean;
  titleClassName?: string;
};

/** Modal ODS. Réservée à ce qui engage : soumettre une semaine, signer, rejeter. */
export function Modal({ open, onClose, title, children, footer, inline, titleClassName = "h3" }: ModalProps) {
  const titleId = useId();
  const ref = useDialog(open, onClose, { lockScroll: !inline });
  if (!open) return null;
  const node = (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={(el) => {
          ref.current = el;
        }}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 className={titleClassName} id={titleId}>
            {title}
          </h2>
          <button className="btn btn-icon btn-sm" type="button" aria-label={dict.form.close} onClick={onClose}>
            <Icon name="cross" />
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
  if (inline) return node;
  // Rendu serveur (panneau ouvert depuis l'adresse) : le portail est posé à l'hydratation.
  return typeof document === "undefined" ? null : createPortal(node, document.body);
}

type OffcanvasProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  /** Le panneau est un formulaire (création, modification). */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  side?: "end" | "start";
  inline?: boolean;
  className?: string;
};

/** Offcanvas ODS : les formulaires longs s'ouvrent dans un panneau, la page reste visible derrière. */
export function Offcanvas({ open, onClose, title, children, footer, closeLabel = dict.form.close, onSubmit, side = "end", inline, className }: OffcanvasProps) {
  const titleId = useId();
  const ref = useDialog(open, onClose, { lockScroll: !inline });
  if (!open) return null;
  const shell = {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
    },
    className: cx("offcanvas", className),
    style: side === "start" ? { left: 0, right: "auto", borderLeft: 0, borderRight: "2px solid #000" } : undefined,
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": titleId,
    tabIndex: -1,
  } as const;
  const content = (
    <>
        <div className="modal-header">
          <h2 className="h3" id={titleId}>
            {title}
          </h2>
          <button className="btn btn-icon btn-sm" type="button" aria-label={closeLabel} onClick={onClose}>
            <Icon name="cross" />
          </button>
        </div>
        {children}
        {footer && (
          <div className="modal-footer" style={{ marginTop: "auto", paddingTop: 20, borderTop: "2px solid #000" }}>
            {footer}
          </div>
        )}
    </>
  );
  const node = (
    <>
      <div className="offcanvas-backdrop" onMouseDown={onClose} aria-hidden="true" />
      {onSubmit ? (
        <form {...shell} onSubmit={onSubmit} noValidate>
          {content}
        </form>
      ) : (
        <div {...shell}>{content}</div>
      )}
    </>
  );
  if (inline) return node;
  // Rendu serveur (panneau ouvert depuis l'adresse) : le portail est posé à l'hydratation.
  return typeof document === "undefined" ? null : createPortal(node, document.body);
}
