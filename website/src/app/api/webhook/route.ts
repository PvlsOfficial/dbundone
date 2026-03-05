import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Verify webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "whsec_placeholder") {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 }
    );
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured." },
      { status: 500 }
    );
  }

  // Read raw body for signature verification — MUST use text(), not json()
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  // Verify webhook signature — prevents replay attacks and spoofed events
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 }
    );
  }

  // Handle events
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log(
          `[PAYMENT] Session ${session.id} completed. ` +
            `Customer: ${session.customer_email || "unknown"}. ` +
            `Amount: ${session.amount_total ? session.amount_total / 100 : 0} ${session.currency?.toUpperCase() || "USD"}. ` +
            `Tier: ${session.metadata?.tier || "unknown"}.`
        );

        // TODO: Implement license provisioning:
        // 1. Generate a unique license key
        // 2. Store in database (customer email -> license key -> tier)
        // 3. Send confirmation email with license key and download links
        // 4. Example: await provisionLicense(session.customer_email, session.metadata?.tier)
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[PAYMENT] Session ${session.id} expired without payment.`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(
          `[PAYMENT] Payment failed for intent ${paymentIntent.id}. ` +
            `Last error: ${paymentIntent.last_payment_error?.message || "unknown"}`
        );
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log(
          `[REFUND] Charge ${charge.id} refunded. ` +
            `Amount: ${charge.amount_refunded / 100} ${charge.currency.toUpperCase()}.`
        );
        // TODO: Revoke license key for this customer
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(
          `[DISPUTE] Dispute ${dispute.id} created for charge ${dispute.charge}.`
        );
        // TODO: Flag account, revoke license, alert admin
        break;
      }

      default:
        // Log unhandled events for monitoring
        console.log(`[STRIPE] Unhandled event type: ${event.type}`);
    }
  } catch (handlerError) {
    // Log handler errors but still return 200 to prevent Stripe retries
    console.error(`Webhook handler error for ${event.type}:`, handlerError);
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
}

// Reject other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
