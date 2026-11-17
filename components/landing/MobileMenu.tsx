"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/strings";

const t = strings.landing.nav;

type NavLink = { href: string; label: string };

// Three-line menu button for phones. The panel drops below the floating
// header and closes on a link tap, Escape, or a tap outside it.
export function MobileMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? t.closeMenu : t.openMenu}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-page"
      >
        {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>
      {open && (
        <nav
          id="mobile-menu"
          aria-label={t.label}
          className="absolute inset-x-2 top-full mt-2 rounded-3xl border border-line bg-surface p-3 shadow-lg shadow-ink/5 sm:inset-x-6"
        >
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-2xl px-3 font-medium text-ink hover:bg-page"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
