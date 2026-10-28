"use client";

import { useEffect, useId, useRef } from "react";
import { strings } from "@/lib/strings";
import { Button } from "./Button";

// In-app confirm. Never use window.confirm or alert.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = strings.common.confirm,
  cancelLabel = strings.common.cancel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={onCancel}
      className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card bg-surface p-5 text-ink backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {body && (
        <p id={bodyId} className="mt-2 text-muted">
          {body}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
