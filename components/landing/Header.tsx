import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { strings } from "@/lib/strings";
import { MobileMenu } from "./MobileMenu";

const t = strings.landing.nav;

const links = [
  { href: "#how-it-works", label: t.howItWorks },
  { href: "#pipeline", label: t.pipeline },
  { href: "#for-officers", label: t.forOfficers },
];

// The anchor links sit in a rounded group in the middle of the bar from
// 1024px up. Below that they are in a three-line menu, and the button stays
// in the bar beside it. Since 19 November 2026 the landing page has no links
// into the trader or officer pages: everyone logs in or signs up first.
export function Header() {
  return (
    <SiteHeader
      nav={
        <nav aria-label={t.label}>
          <ul className="flex items-center gap-1 rounded-full border border-surface/15 bg-surface/5 p-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium text-surface/85 hover:bg-surface/10 hover:text-surface"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      }
    >
      <Link
        href="/login"
        className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-surface/85 hover:text-surface sm:inline-flex"
      >
        {t.login}
      </Link>
      <ButtonLink href="/signup" size="sm" pill>
        {t.signup}
        <ArrowRight size={16} aria-hidden="true" />
      </ButtonLink>
      <MobileMenu links={[...links, { href: "/login", label: t.login }]} />
    </SiteHeader>
  );
}
