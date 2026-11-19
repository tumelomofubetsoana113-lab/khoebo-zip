"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { strings } from "@/lib/strings";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const inputClasses =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-status-followup";

// A labelled input with an optional hint and error, linked for screen readers.
export function Field({ label, hint, error, type = "text", ...props }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="relative mt-1.5">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`${inputClasses} ${isPassword ? "pr-12" : ""}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? strings.auth.fields.hide : strings.auth.fields.show}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-ink"
          >
            {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-status-followup">
          {error}
        </p>
      )}
    </div>
  );
}

// The message above the form when something went wrong.
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-status-followup-bg px-3 py-2.5 text-sm font-medium text-status-followup">
      {message}
    </p>
  );
}
