import type { Metadata } from "next";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { ActionPill, Pill, PrototypePill } from "@/components/ui/Pill";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { OverlayDemos } from "./OverlayDemos";

export const metadata: Metadata = {
  title: "Style guide",
  robots: { index: false },
};

// Swatches use the token class names, so this page also proves every token
// exists in the Tailwind theme.
const swatches = [
  { token: "flag-blue", bg: "bg-flag-blue" },
  { token: "flag-green", bg: "bg-flag-green" },
  { token: "green-text", bg: "bg-green-text" },
  { token: "page", bg: "bg-page" },
  { token: "surface", bg: "bg-surface" },
  { token: "ink", bg: "bg-ink" },
  { token: "muted", bg: "bg-muted" },
  { token: "line", bg: "bg-line" },
  { token: "status-followup", bg: "bg-status-followup" },
  { token: "status-followup-bg", bg: "bg-status-followup-bg" },
  { token: "status-review", bg: "bg-status-review" },
  { token: "status-review-bg", bg: "bg-status-review-bg" },
  { token: "status-checkin", bg: "bg-status-checkin" },
  { token: "status-checkin-bg", bg: "bg-status-checkin-bg" },
  { token: "status-none", bg: "bg-status-none" },
  { token: "status-none-bg", bg: "bg-status-none-bg" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuide() {
  return (
    <>
      <SiteHeader>
        <ButtonLink href="/" size="sm">
          Home
        </ButtonLink>
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-12 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-[30px] font-bold leading-tight sm:text-[40px]">Style guide</h1>
          <p className="mt-2 text-muted">Palette, type and shared components. Internal page.</p>
        </div>

        <Section title="Palette">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {swatches.map((s) => (
              <li key={s.token} className="overflow-hidden rounded-card border border-line bg-surface">
                <div className={`h-14 ${s.bg}`} />
                <p className="px-3 py-2 text-sm font-medium">{s.token}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <Card className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Eyebrow in muted caps
            </p>
            <p className="text-[30px] font-bold leading-tight sm:text-[40px]">
              Keep your business records in a chat.
            </p>
            <p>Body text at 16px in ink.</p>
            <p className="text-muted">Secondary text in muted.</p>
            <p className="font-semibold text-green-text">Green text uses green-text.</p>
            <a href="#" className="text-flag-blue underline">
              A link in flag-blue
            </a>
          </Card>
        </Section>

        <Section title="Pills">
          <div className="flex flex-wrap gap-2">
            <ActionPill action="followup" />
            <ActionPill action="review" />
            <ActionPill action="checkin" />
            <ActionPill action="none" />
            <PrototypePill />
            <Pill>Neutral</Pill>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-3 rounded-card bg-flag-blue p-5">
            <Button variant="inverse">Try the trader chat</Button>
            <Button variant="inverse-outline">Open the officer view</Button>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <h3 className="font-semibold">Card title</h3>
              <p className="mt-1 text-muted">Cards use a 12px radius and a line border.</p>
            </Card>
            <Card className="space-y-2">
              <ActionPill action="review" />
              <p>Nil returns, but about M3,000 a month of wallet inflows.</p>
            </Card>
          </div>
        </Section>

        <Section title="Sheet and confirm dialog">
          <OverlayDemos />
        </Section>

        <Section title="Logo">
          <Card className="flex flex-wrap items-center gap-6">
            <Logo size={128} />
            <div className="flex items-center gap-2 rounded-card bg-flag-blue px-3 py-2 text-surface">
              <Logo size={40} className="rounded-full ring-2 ring-surface" />
              <div className="leading-tight">
                <p className="font-semibold">Khoebo</p>
                <p className="text-xs">Records and tax assistant</p>
              </div>
            </div>
            <Logo size={28} />
            <Logo size={16} />
            <p className="text-muted">
              Files: <code>public/brand/</code> (SVG, and square PNGs for profile pictures), <code>app/icon.svg</code>,{" "}
              <code>app/apple-icon.png</code>.
            </p>
          </Card>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
