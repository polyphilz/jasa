import { AlertDialog } from "@base-ui-components/react/alert-dialog";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export const ConfirmDialog = ({
  trigger,
  triggerClassName,
  triggerLabel,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) => (
  <AlertDialog.Root>
    <AlertDialog.Trigger className={triggerClassName} aria-label={triggerLabel}>
      {trigger}
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
      <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
      <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-xl">
        <AlertDialog.Title className="text-sm font-bold text-ink text-balance">
          {title}
        </AlertDialog.Title>
        <AlertDialog.Description className="mt-1.5 text-[13px] text-muted text-pretty">
          {description}
        </AlertDialog.Description>
        <div className="mt-4 flex justify-end gap-2">
          <AlertDialog.Close className="jasa-btn">Cancel</AlertDialog.Close>
          <AlertDialog.Close className="jasa-btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialog.Close>
        </div>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
);
