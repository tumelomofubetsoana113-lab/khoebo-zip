import { ButtonLink } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { strings } from "@/lib/strings";

// The landing page's floating header, with a link to the chat.
export function OfficerHeader() {
  return (
    <SiteHeader>
      <ButtonLink href="/trader" size="sm">
        {strings.landing.nav.tryChat}
      </ButtonLink>
    </SiteHeader>
  );
}
