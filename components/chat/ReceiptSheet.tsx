"use client";

import { Camera, FileText, ReceiptText } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { prepareReceipt, type ReceiptAttachment } from "@/lib/receipts";
import { strings } from "@/lib/strings";

const t = strings.chat.receipt;

const optionClass =
  "flex min-h-14 w-full items-center gap-3 rounded-card border border-line p-3 text-left hover:bg-page disabled:opacity-50";
const iconClass = "flex size-11 shrink-0 items-center justify-center rounded-full bg-flag-blue text-surface";

export function ReceiptSheet({
  open,
  disabled,
  onClose,
  onSend,
}: {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onSend: (attachment: ReceiptAttachment) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = disabled || busy;

  async function prepare(file: Blob) {
    setBusy(true);
    setError(null);
    const prepared = await prepareReceipt(file);
    setBusy(false);
    if (prepared.ok) onSend(prepared.attachment);
    else setError(t.errors[prepared.error]);
  }

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so the same file can be chosen again
    if (file) void prepare(file);
  }

  async function sendSample(src: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await prepare(await response.blob());
    } catch {
      setBusy(false);
      setError(t.errors.sample);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <p className="text-sm text-muted">{t.intro}</p>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={chosen} />
      <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={chosen} />

      <div className="mt-3 space-y-2">
        <button type="button" disabled={blocked} onClick={() => cameraInput.current?.click()} className={optionClass}>
          <span aria-hidden="true" className={iconClass}>
            <Camera size={20} />
          </span>
          <span className="font-semibold">{t.takePhoto}</span>
        </button>
        <button type="button" disabled={blocked} onClick={() => fileInput.current?.click()} className={optionClass}>
          <span aria-hidden="true" className={iconClass}>
            <FileText size={20} />
          </span>
          <span className="font-semibold">{t.choose}</span>
        </button>
      </div>

      <p className="mt-3 text-sm text-muted">{t.privacy}</p>

      <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-status-followup">
        {error ?? (busy ? <span className="font-normal text-muted">{t.preparing}</span> : null)}
      </p>

      <p className="mt-2 font-semibold">{t.samplesHeading}</p>
      <ul className="mt-2 space-y-2">
        {t.samples.map((sample) => (
          <li key={sample.src}>
            <button type="button" disabled={blocked} onClick={() => void sendSample(sample.src)} className={optionClass}>
              <ReceiptText size={22} aria-hidden="true" className="shrink-0 text-flag-blue" />
              <span className="min-w-0">
                <span className="block">{sample.title}</span>
                <span className="block text-sm text-muted">{sample.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
