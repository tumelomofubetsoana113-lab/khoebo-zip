import { strings } from "@/lib/strings";

export function TypingIndicator() {
  return (
    <div className="flex" role="status" aria-label={strings.chat.typing}>
      <div className="flex gap-1 rounded-bubble rounded-bl-md border border-line bg-surface px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            className="size-2 animate-pulse rounded-full bg-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
