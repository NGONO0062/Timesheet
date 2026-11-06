// Modal et Offcanvas ODS, sur le Dialog de HeadlessUI (focus piégé, Échap, retour
// du focus au déclencheur). Voile noir à 50 % : la seule transparence de l'application.
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import type { FormEventHandler, ReactNode } from "react";
import { cx } from "@/shared/lib/cx";
import { dict } from "@/shared/i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";

const BACKDROP = "fixed inset-0 bg-black/50";

function Header({ title, closeLabel, onClose, titleClassName = "text-h3" }: { title: ReactNode; closeLabel: string; onClose: () => void; titleClassName?: string }) {
  return (
    <div className="flex items-start justify-between gap-20">
      <DialogTitle as="h2" className={titleClassName}>
        {title}
      </DialogTitle>
      <Button size="sm" className="w-control-sm px-0" aria-label={closeLabel} onClick={onClose}>
        <Icon name="cross" />
      </Button>
    </div>
  );
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  titleClassName?: string;
};

/** Modal ODS. Réservée à ce qui engage : soumettre une semaine, signer, rejeter. */
export function Modal({ open, onClose, title, children, footer, titleClassName }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className={BACKDROP} />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-20 py-60">
        <DialogPanel className="flex w-full max-w-modal flex-col gap-20 rounded-lg border-2 border-black bg-white p-30">
          <Header title={title} closeLabel={dict.form.close} onClose={onClose} titleClassName={titleClassName} />
          {children}
          {footer && <div className="flex flex-wrap justify-end gap-10">{footer}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
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
  className?: string;
};

/** Offcanvas ODS : les formulaires longs s'ouvrent dans un panneau, la page reste visible derrière. */
export function Offcanvas({ open, onClose, title, children, footer, closeLabel = dict.form.close, onSubmit, side = "end", className }: OffcanvasProps) {
  const content = (
    <>
      <Header title={title} closeLabel={closeLabel} onClose={onClose} />
      {children}
      {footer && <div className="mt-auto flex flex-wrap justify-end gap-10 border-t-2 border-black pt-20">{footer}</div>}
    </>
  );
  const panel = cx(
    "fixed inset-y-0 flex w-full max-w-offcanvas flex-col gap-20 overflow-y-auto border-black bg-white p-30",
    side === "start" ? "left-0 border-r-2" : "right-0 border-l-2",
    className,
  );
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className={BACKDROP} />
      {onSubmit ? (
        <DialogPanel as="form" className={panel} onSubmit={onSubmit} noValidate>
          {content}
        </DialogPanel>
      ) : (
        <DialogPanel className={panel}>{content}</DialogPanel>
      )}
    </Dialog>
  );
}
