import { ButtonLink } from "@/components/ui/Button";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { strings } from "@/lib/strings";
import { MobileMenu } from "./MobileMenu";

const t = strings.landing.nav;

const links = [
  { href: "#how-it-works", label: t.howItWorks },
  { href: "#for-officers", label: t.forOfficers },
  { href: "#results", label: t.results },
];

// Anchor links and the button on desktop. On phones there's no room for both
// the button and a menu, so the links and the button sit in a three-line menu.
export function Header() {
  return (
    <SiteHeader>
      <nav aria-label={t.label} className="hidden md:block">
        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-ink hover:bg-page"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hidden md:block">
        <ButtonLink href="/trader" size="sm">
          {t.tryChat}
        </ButtonLink>
      </div>
      <MobileMenu links={links} />
    </SiteHeader>
  );
}
