"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { buttonClasses } from "@/components/ui/Button";
import { strings } from "@/lib/strings";
import { useAccount } from "./AccountProvider";

const t = strings.auth;

// "Log out" for the floating header, with the officer's name beside it
// from 768px up.
export function AccountMenu() {
  const account = useAccount();
  return (
    <div className="flex items-center gap-2">
      {account && <span className="hidden text-sm text-surface/75 md:inline">{t.signedInAs(account.fullName)}</span>}
      <form action={logout}>
        <button type="submit" className={buttonClasses("inverse-outline", "sm", "", true)}>
          <LogOut size={16} aria-hidden="true" />
          {t.logout}
        </button>
      </form>
    </div>
  );
}

// A round icon button for the chat's orange header.
export function LogoutIconButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        aria-label={t.logout}
        title={t.logout}
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface/10"
      >
        <LogOut size={20} aria-hidden="true" />
      </button>
    </form>
  );
}
