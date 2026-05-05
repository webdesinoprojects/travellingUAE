import { Hero } from "@/components/home/Hero";
import { PackageBento } from "@/components/home/PackageBento";
import { ServicesStrip } from "@/components/home/ServicesStrip";
import { SmartExclusives } from "@/components/home/SmartExclusives";
import { Testimonials } from "@/components/home/Testimonials";
import { FloatingSocial } from "@/components/layout/FloatingSocial";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <SmartExclusives />
        <PackageBento />
        <ServicesStrip />
        <Testimonials />
      </main>
      <SiteFooter />
      <WhatsAppButton />
      <FloatingSocial />
    </div>
  );
}
