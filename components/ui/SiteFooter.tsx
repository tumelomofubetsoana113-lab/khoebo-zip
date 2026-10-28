import { strings } from "@/lib/strings";
import { Stripe } from "./Stripe";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
        {strings.footer.text}
      </p>
      <Stripe />
    </footer>
  );
}
