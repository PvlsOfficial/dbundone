import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is not set in production");
}

// Create Stripe client — in development, allow missing key (checkout will return error)
export const stripe = secretKey
  ? new Stripe(secretKey, { typescript: true })
  : (null as unknown as Stripe);

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
