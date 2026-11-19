import { ButtonLink } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { strings } from "@/lib/strings";

// The floating header for officer pages, with a link to the chat.
export function OfficerHeader() {
  return (
    <SiteHeader>
      <ButtonLink href="/trader" size="sm" pill>
        {strings.landing.nav.tryChat}
      </ButtonLink>
    </SiteHeader>
  );
}
