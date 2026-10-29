import { MessageBubble } from "@/components/chat/MessageBubble";
import { SummaryCard } from "@/components/chat/SummaryCard";
import { Logo } from "@/components/ui/Logo";
import { strings } from "@/lib/strings";

const t = strings.landing.hero;
const demo = t.demo;

// A phone drawn in HTML and CSS, showing a short static chat built from the
// same bubble components as the real chat.
export function PhoneFrame() {
  return (
    <figure
      aria-label={t.phoneLabel}
      className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[40px] border-[10px] border-ink bg-page shadow-xl shadow-ink/10"
    >
      <div className="flex items-center gap-3 bg-flag-blue px-4 pb-3 pt-5 text-surface">
        <Logo size={36} className="rounded-full ring-2 ring-surface" />
        <div className="leading-tight">
          <p className="font-semibold">{strings.chat.title}</p>
          <p className="text-xs">{strings.chat.subtitle}</p>
        </div>
      </div>
      <div className="space-y-3 px-3 py-4">
        <MessageBubble from="trader" time={demo.times[0]}>
          {demo.trader1}
        </MessageBubble>
        <MessageBubble from="assistant" time={demo.times[1]}>
          {demo.reply1}
        </MessageBubble>
        <MessageBubble from="trader" time={demo.times[2]}>
          {demo.trader2}
        </MessageBubble>
        <MessageBubble from="assistant" time={demo.times[3]}>
          <SummaryCard
            period={demo.summaryPeriod}
            moneyIn={demo.moneyIn}
            moneyOut={demo.moneyOut}
            profit={demo.profit}
          />
        </MessageBubble>
      </div>
    </figure>
  );
}
