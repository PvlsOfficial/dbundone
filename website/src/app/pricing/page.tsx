import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PricingCards } from "@/components/sections/PricingCards";
import { FAQ } from "@/components/sections/FAQ";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DBundone pricing — start free, upgrade to Pro with a one-time $79 payment. No subscriptions, no recurring fees.",
  alternates: {
    canonical: "https://dbundone.com/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <PricingCards />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
