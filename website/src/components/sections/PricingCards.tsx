"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/constants";
import { motion } from "framer-motion";
import Link from "next/link";

export function PricingCards() {
  return (
    <section id="pricing" className="relative py-32">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="text-center max-w-[600px] mx-auto mb-16">
          <p className="text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-tight mb-4">
            Simple, honest pricing
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Start free. Upgrade once. No subscriptions, no recurring fees. Pay
            once and own it forever.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-[800px] mx-auto items-start">
          {PRICING_TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} index={i} />
          ))}
        </div>

        {/* Payment methods */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PaymentIcon label="Visa">
              <path d="M2 6h20v12H2V6zm1 1v10h18V7H3zm3 3h3v1H6v-1zm5 0h3v1h-3v-1zm5 0h3v1h-3v-1zM6 12h12v1H6v-1z" />
            </PaymentIcon>
            <PaymentIcon label="Mastercard">
              <path d="M12 6a6 6 0 100 12 6 6 0 000-12zm-3.5 6a3.5 3.5 0 017 0 3.5 3.5 0 01-7 0z" />
              <circle cx="9.5" cy="12" r="3.5" opacity="0.4" />
              <circle cx="14.5" cy="12" r="3.5" opacity="0.4" />
            </PaymentIcon>
            <PaymentIcon label="Apple Pay">
              <path d="M18.71 6.53A3.07 3.07 0 0016.76 5a3.24 3.24 0 00-2.37 1.22 3.03 3.03 0 00-.76 2.15 2.69 2.69 0 002.14-.94A3.12 3.12 0 0016.53 6a2.93 2.93 0 00.68-.97 2.78 2.78 0 001.5 1.5z" />
              <path d="M17.05 8.79c-1.2-.07-2.22.68-2.79.68s-1.45-.65-2.4-.63a3.56 3.56 0 00-3 1.82c-1.29 2.22-.33 5.52.92 7.33.62.89 1.35 1.89 2.32 1.86s1.28-.6 2.4-.6 1.44.6 2.42.58 1.63-.91 2.25-1.8a8.07 8.07 0 001-2.07 3.13 3.13 0 01-1.9-2.87 3.18 3.18 0 011.52-2.67 3.27 3.27 0 00-2.74-1.63z" />
            </PaymentIcon>
            <PaymentIcon label="Google Pay">
              <path d="M12.5 8.8l-.1.1-2.1 1.7c-.3-.5-.7-.9-1.3-1.1-.5-.2-1.1-.3-1.7-.2-1.2.2-2.2 1-2.7 2.1-.5 1.2-.3 2.5.4 3.5.8 1 2 1.5 3.2 1.3.7-.1 1.3-.4 1.8-.9l.3-.3h-2.5v-2h4.7c.1.4.1.8.1 1.2 0 1.5-.5 2.9-1.5 3.9-1.1 1.1-2.6 1.7-4.2 1.6C4.7 19.5 3 17.5 3 15s1.7-4.5 4-4.8c1-.1 2 .1 2.9.6.7.4 1.4 1 1.8 1.7l.8-3.7z" />
              <path d="M20.2 11.3c-.4-.3-1-.5-1.7-.5-.8 0-1.4.3-1.8.8v-.6h-1.4V18h1.5v-4.2c0-1 .5-1.6 1.3-1.6.7 0 1.1.5 1.1 1.3V18H21v-4.8c0-1-.3-1.6-.8-1.9z" />
            </PaymentIcon>
            <PaymentIcon label="PayPal">
              <path d="M7.4 20H5.2l1.5-9.5h2.9c1.4 0 2.5.4 3 1.2.5.7.5 1.7.3 2.8-.5 2.7-2.2 4-5 4H7l-.3 1.5h.7zm1.8-3h.7c1.5 0 2.3-.7 2.6-2.1.2-.8.1-1.3-.2-1.7-.3-.3-.9-.5-1.6-.5H9.4l-.6 4.3h.4z" />
              <path d="M15.4 17h-2.2l1.5-9.5h2.9c1.4 0 2.5.4 3 1.2.5.7.5 1.7.3 2.8-.5 2.7-2.2 4-5 4h-.8l-.3 1.5h.6zm1.8-3h.7c1.5 0 2.3-.7 2.6-2.1.2-.8.1-1.3-.2-1.7-.3-.3-.9-.5-1.6-.5h-1.3l-.6 4.3h.4z" opacity="0.5" />
            </PaymentIcon>
            <PaymentIcon label="Cash App">
              <rect x="4" y="4" width="16" height="16" rx="4" opacity="0.15" />
              <path d="M14.25 10.16c-.3-.27-.67-.43-1.08-.43-.47 0-.82.2-.82.56 0 .38.42.5 1.01.68.97.28 1.76.7 1.76 1.76 0 1.3-1.1 2.02-2.44 2.02-.93 0-1.76-.34-2.4-.96l.96-1.06c.38.38.84.64 1.42.64.5 0 .9-.2.9-.6 0-.4-.48-.56-1.12-.74-.9-.28-1.66-.66-1.66-1.7 0-1.22 1.04-1.96 2.3-1.96.82 0 1.56.28 2.12.82l-.95.97z" />
            </PaymentIcon>
          </div>
          <p className="text-xs text-muted-foreground/50">
            14-day money-back guarantee &middot; Secure checkout via Stripe
            &middot;{" "}
            <Link
              href="/refund"
              className="hover:text-muted-foreground transition-colors underline"
            >
              Refund policy
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  tier,
  index,
}: {
  tier: (typeof PRICING_TIERS)[number];
  index: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!tier.highlighted) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "pro" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start checkout"
      );
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={`relative rounded-xl p-6 flex flex-col ${
        tier.highlighted
          ? "animated-border"
          : "border border-border/50 bg-card/50"
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground uppercase tracking-wider">
            Best Value
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {tier.description}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight">
            {tier.price}
          </span>
          <span className="text-sm text-muted-foreground">{tier.period}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-[13px] text-muted-foreground">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div>
        {tier.highlighted ? (
          <>
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                tier.cta
              )}
            </Button>
            {error && (
              <p className="mt-2 text-xs text-destructive text-center">
                {error}
              </p>
            )}
          </>
        ) : (
          <Button
            asChild
            variant="outline"
            className="w-full h-10 border-border/60 text-sm font-medium"
          >
            <Link href={tier.ctaHref}>{tier.cta}</Link>
          </Button>
        )}
      </div>
    </motion.div>
  );
}
