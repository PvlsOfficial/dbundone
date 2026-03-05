import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  stripe,
  ALLOWED_PRICES,
  PriceTier,
  isStripeConfigured,
} from "@/lib/stripe";

// In-memory rate limiter (use Redis/Upstash in production for multi-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const MAX_MAP_SIZE = 10_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  if (rateLimitMap.size > MAX_MAP_SIZE) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// All payment methods to offer at checkout
// Card includes: Visa, Mastercard, Amex, Discover, etc.
// Apple Pay & Google Pay are automatic with "card" when customer's device supports them
// Enable each of these in Stripe Dashboard → Settings → Payment Methods
const PAYMENT_METHODS: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
  [
    "card", // Visa, Mastercard, Amex + Apple Pay + Google Pay
    "paypal", // PayPal
    "cashapp", // Cash App
    "link", // Stripe Link (one-click checkout for returning customers)
    "klarna", // Klarna (buy now pay later)
    "bancontact", // Bancontact (Belgium)
    "eps", // EPS (Austria)
    "giropay", // Giropay (Germany)
    "ideal", // iDEAL (Netherlands)
    "p24", // Przelewy24 (Poland)
    "sofort", // Sofort/Klarna (EU bank transfer)
  ];

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        {
          error:
            "Payments are not configured yet. Please contact support@dbundone.com.",
        },
        { status: 503 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const tier = body.tier as PriceTier;

    if (!tier || typeof tier !== "string" || !(tier in ALLOWED_PRICES)) {
      return NextResponse.json(
        { error: "Invalid pricing tier." },
        { status: 400 }
      );
    }

    const priceId = ALLOWED_PRICES[tier];

    if (!priceId) {
      return NextResponse.json(
        { error: "Pricing not configured for this tier." },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    // NOTE: payment_intent_data is NOT used here because PayPal/Klarna/etc
    // create their own payment objects. Metadata goes on the session instead.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: PAYMENT_METHODS,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_creation: "always",
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        tier,
        source: "website",
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
