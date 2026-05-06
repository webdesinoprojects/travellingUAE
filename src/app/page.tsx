import { Hero } from "@/components/home/Hero";
import { PackageBento } from "@/components/home/PackageBento";
import { ServicesStrip } from "@/components/home/ServicesStrip";
import { SmartExclusives } from "@/components/home/SmartExclusives";
import { Testimonials } from "@/components/home/Testimonials";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <main>
        <Hero />
        <SmartExclusives />
        <PackageBento />
        <ServicesStrip />
        <Testimonials />
      </main>
      <SiteFooter />
    </div>
  );
}
