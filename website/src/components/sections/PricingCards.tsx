"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING_TIERS } from "@/lib/constants";
import { motion } from "framer-motion";
import Link from "next/link";

function PaymentIcon({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors"
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="currentColor"
        aria-hidden="true"
      >
        {children}
      </svg>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </div>
  );
}

const paymentMethods = [
  {
    label: "Visa",
    icon: (
      <>
        <rect
          x="2"
          y="5"
          width="20"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M10.5 10L9 15h1.3l1.5-5H10.5zM14.2 10l-2.1 5h1.3l.5-1.2h2l.5 1.2h1.3L15.6 10h-1.4zm.1 2.6l.6-1.4.6 1.4h-1.2z" />
      </>
    ),
  },
  {
    label: "Mastercard",
    icon: (
      <>
        <circle cx="9" cy="12" r="4" opacity="0.5" />
        <circle cx="15" cy="12" r="4" opacity="0.5" />
      </>
    ),
  },
  {
    label: "Apple Pay",
    icon: (
      <path d="M17.05 8.8c-1.2-.06-2.22.68-2.79.68s-1.45-.65-2.4-.63a3.56 3.56 0 00-3 1.83c-1.29 2.21-.33 5.51.92 7.32.62.9 1.35 1.9 2.32 1.86.93-.04 1.28-.6 2.4-.6s1.44.6 2.42.58c1 0 1.63-.9 2.25-1.8a8 8 0 001-2.07 3.14 3.14 0 01-1.9-2.87 3.18 3.18 0 011.52-2.67 3.27 3.27 0 00-2.74-1.63zm-.34-2.27a3.07 3.07 0 00.7-2.2A3.12 3.12 0 0015.53 6a2.93 2.93 0 00-.68.97 2.69 2.69 0 00.37 2.3c.53.47 1.15.56 1.49.26z" />
    ),
  },
  {
    label: "Google Pay",
    icon: (
      <>
        <path
          d="M12.24 10.3V13h3.73a3.2 3.2 0 01-1.39 2.1l2.24 1.74a6.54 6.54 0 002-5.04c0-.58-.05-1.14-.15-1.68H12.24z"
          opacity="0.8"
        />
        <path
          d="M5.98 13.28a3.87 3.87 0 015.76-3.34l2.04-2.04a6.54 6.54 0 00-10.3 4.1l2.5 1.28z"
          opacity="0.6"
        />
        <path
          d="M12.24 19.58a6.26 6.26 0 004.34-1.58l-2.24-1.74a3.89 3.89 0 01-5.86-2.04l-2.5 1.94a6.54 6.54 0 006.26 3.42z"
          opacity="0.7"
        />
      </>
    ),
  },
  {
    label: "PayPal",
    icon: (
      <>
        <path d="M7.4 20.5l.5-2.8h-1.8l2-12.2h5c2.3 0 3.8 1.5 3.5 3.7-.5 3.4-3 5-6 5h-1.5l-.8 4.8-.3 1.5H7.4z" />
        <path
          d="M17.1 8.5c.3-2.2-1.2-3.7-3.5-3.7h-5L6.7 17.7h1.7l.8-4.8h1.5c3 0 5.5-1.6 6-5l.4-2.4z"
          opacity="0.4"
        />
      </>
    ),
  },
  {
    label: "Klarna",
    icon: (
      <>
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M7 10h3v4H7v-4zm5 0c0 1.5-.6 2.8-1.6 3.7L12 15.5h-2l-1-1.3V10h1.5v2.5c.6-.7 1.5-1.2 2.5-1.2V10zm3.5 0H17v5h-1.5V10z" />
      </>
    ),
  },
  {
    label: "Cash App",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" opacity="0.15" />
        <path d="M14.25 10.16c-.3-.27-.67-.43-1.08-.43-.47 0-.82.2-.82.56 0 .38.42.5 1.01.68.97.28 1.76.7 1.76 1.76 0 1.3-1.1 2.02-2.44 2.02-.93 0-1.76-.34-2.4-.96l.96-1.06c.38.38.84.64 1.42.64.5 0 .9-.2.9-.6 0-.4-.48-.56-1.12-.74-.9-.28-1.66-.66-1.66-1.7 0-1.22 1.04-1.96 2.3-1.96.82 0 1.56.28 2.12.82l-.95.97z" />
      </>
    ),
  },
  {
    label: "Link",
    icon: (
      <>
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M8.5 12h1.5M14 12h1.5"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      </>
    ),
  },
  {
    label: "iDEAL",
    icon: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="12"
          cy="12"
          r="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M12 9v6M9 12h6" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  },
  {
    label: "SOFORT",
    icon: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 12h10M7 9.5h6M7 14.5h8"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      </>
    ),
  },
];

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
        <div className="mt-12 flex flex-col items-center gap-5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40">
            We accept
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {paymentMethods.map((pm) => (
              <PaymentIcon key={pm.label} label={pm.label}>
                {pm.icon}
              </PaymentIcon>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/50">
            14-day money-back guarantee &middot; Secure checkout powered by
            Stripe &middot;{" "}
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
