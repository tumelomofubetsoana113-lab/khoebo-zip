import { AccountMenu } from "@/components/auth/LogoutButton";
import { SiteHeader } from "@/components/ui/SiteHeader";

// The floating header for officer pages, with the officer's name and
// "Log out" (since 19 November 2026; it used to link to the chat).
export function OfficerHeader() {
  return (
    <SiteHeader>
      <AccountMenu />
    </SiteHeader>
  );
}
