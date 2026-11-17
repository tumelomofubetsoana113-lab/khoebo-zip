import { BuiltForLesotho } from "@/components/landing/BuiltForLesotho";
import { ClosingBand } from "@/components/landing/ClosingBand";
import { ForOfficers } from "@/components/landing/ForOfficers";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pipeline } from "@/components/landing/Pipeline";
import { Problem } from "@/components/landing/Problem";
import { Results } from "@/components/landing/Results";
import { SiteFooter } from "@/components/ui/SiteFooter";

export default function Home() {
  // White behind the floating header, instead of the grey page colour.
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <Header />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Pipeline />
        <HowItWorks />
        <ForOfficers />
        <BuiltForLesotho />
        <Results />
        <ClosingBand />
      </main>
      <SiteFooter />
    </div>
  );
}
