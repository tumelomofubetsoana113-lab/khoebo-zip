import { ButtonLink } from "@/components/ui/Button";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";

// Placeholder until the landing page is built in step 2.
export default function Home() {
  return (
    <>
      <SiteHeader>
        <ButtonLink href="/styleguide" size="sm">
          Style guide
        </ButtonLink>
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 sm:px-6">
        <p className="text-muted">The landing page is built in step 2.</p>
      </main>
      <SiteFooter />
    </>
  );
}
