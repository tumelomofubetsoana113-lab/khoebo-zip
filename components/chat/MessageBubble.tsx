import type { ReactNode } from "react";

// One chat message. Shared by the real chat and the landing page phone,
// so the two always match.
export function MessageBubble({
  from,
  time,
  wide = false,
  children,
}: {
  from: "trader" | "assistant";
  time?: string;
  wide?: boolean; // for messages that carry cards
  children: ReactNode;
}) {
  const mine = from === "trader";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`${wide ? "w-[92%]" : "max-w-[85%]"} rounded-bubble px-3.5 py-2 text-base leading-snug ${
          mine
            ? "rounded-br-md bg-brand text-surface"
            : "rounded-bl-md border border-line bg-surface text-ink"
        }`}
      >
        {children}
      </div>
      {time && <span className="mt-1 px-1 text-xs text-muted">{time}</span>}
    </div>
  );
}
