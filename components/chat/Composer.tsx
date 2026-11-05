"use client";

import { Camera, Mic, SendHorizontal } from "lucide-react";
import { useState } from "react";
import { strings } from "@/lib/strings";

const MAX_CHARS = 500;

// The send button turns into the mic button when the field is empty, as
// messaging apps do.
export function Composer({
  disabled,
  onSend,
  onOpenVoice,
  onOpenReceipt,
}: {
  disabled: boolean; // a reply is on its way
  onSend: (text: string) => void;
  onOpenVoice: () => void;
  onOpenReceipt: () => void;
}) {
  const [text, setText] = useState("");
  const hasText = text.trim().length > 0;

  return (
    <form
      className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hasText || disabled) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <button
        type="button"
        onClick={onOpenReceipt}
        aria-label={strings.chat.receipt.open}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-flag-blue hover:bg-page"
      >
        <Camera size={20} aria-hidden="true" />
      </button>
      <label htmlFor="composer" className="sr-only">
        {strings.chat.placeholder}
      </label>
      <input
        id="composer"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_CHARS}
        placeholder={strings.chat.placeholder}
        autoComplete="off"
        enterKeyHint="send"
        className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-page px-4 text-base text-ink placeholder:text-muted"
      />
      {hasText ? (
        <button
          type="submit"
          disabled={disabled}
          aria-label={strings.chat.send}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-flag-blue text-surface disabled:opacity-50"
        >
          <SendHorizontal size={20} aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenVoice}
          aria-label={strings.chat.openVoice}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-flag-blue text-surface"
        >
          <Mic size={20} aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
