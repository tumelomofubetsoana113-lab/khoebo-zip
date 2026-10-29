"use client";

import { Play } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { strings } from "@/lib/strings";

const t = strings.chat.voice;

export type VoiceSample = (typeof t.samples)[number];

export function VoiceSheet({
  open,
  disabled,
  onClose,
  onPick,
}: {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onPick: (sample: VoiceSample) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={t.title}>
      <p className="text-sm text-muted">{t.intro}</p>
      <ul className="mt-3 space-y-2">
        {t.samples.map((sample) => (
          <li key={sample.transcript}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(sample)}
              className="flex w-full items-center gap-3 rounded-card border border-line p-3 text-left hover:bg-page disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-flag-blue text-surface"
              >
                <Play size={18} className="fill-current" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-muted">
                  <span className="sr-only">{t.play}, </span>
                  {sample.duration}
                </span>
                <span className="block">&ldquo;{sample.transcript}&rdquo;</span>
                {"translation" in sample && (
                  <span className="block text-sm text-muted">({sample.translation})</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
