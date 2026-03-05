import "server-only";
import Stripe from "stripe";

// Lazy-initialized Stripe client — avoids build-time errors when env vars aren't set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment variables."
      );
    }
    _stripe = new Stripe(secretKey, { typescript: true });
  }
  return _stripe;
}

// Server-side price allowlist — prevents client-side price manipulation
// Keys are the tier names the client can request; values are Stripe Price IDs
export const ALLOWED_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || "",
} as const;

export type PriceTier = keyof typeof ALLOWED_PRICES;

export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_PRO &&
    process.env.STRIPE_PRICE_PRO !== "price_placeholder"
  );
}
