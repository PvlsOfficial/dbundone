import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { LogoCloud } from "@/components/sections/LogoCloud";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { VSTSection } from "@/components/sections/VSTSection";
import { PricingCards } from "@/components/sections/PricingCards";
import { Testimonials } from "@/components/sections/Testimonials";
import { FAQ } from "@/components/sections/FAQ";
import { DownloadCTA } from "@/components/sections/DownloadCTA";
import { SchemaMarkup } from "@/components/shared/SchemaMarkup";

export default function Home() {
  return (
    <>
      <SchemaMarkup />
      <Header />
      <main>
        <Hero />
        <LogoCloud />
        <FeatureGrid />
        <VSTSection />
        <PricingCards />
        <Testimonials />
        <FAQ />
        <DownloadCTA />
      </main>
      <Footer />
    </>
  );
}
