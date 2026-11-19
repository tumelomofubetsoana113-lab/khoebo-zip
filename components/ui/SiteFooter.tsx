import { strings } from "@/lib/strings";
import { Logo } from "./Logo";

// The Khoebo mark and name, with the prototype notice (rule 5) centred under it.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-page">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted sm:px-6">
        <p className="inline-flex items-center gap-2 font-semibold text-ink">
          <Logo size={24} />
          {strings.brand.name}
        </p>
        <p>{strings.footer.text}</p>
      </div>
    </footer>
  );
}
