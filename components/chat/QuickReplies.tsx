import { strings } from "@/lib/strings";

export function QuickReplies({
  options,
  disabled,
  onPick,
}: {
  options: string[];
  disabled: boolean;
  onPick: (option: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div role="group" aria-label={strings.chat.quickRepliesLabel} className="flex flex-wrap gap-2 pl-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option)}
          className="min-h-10 rounded-full border border-flag-blue bg-surface px-4 text-base font-medium text-flag-blue hover:bg-status-review-bg disabled:opacity-50"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
