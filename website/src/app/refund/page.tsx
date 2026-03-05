import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "DBundone refund policy. 14-day money-back guarantee, no questions asked.",
  alternates: { canonical: "https://dbundone.com/refund" },
};

export default function RefundPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <article className="mx-auto max-w-[680px] px-6">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Refund Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: March 1, 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted-foreground leading-[1.75]">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                14-Day Money-Back Guarantee
              </h2>
              <p>
                We offer a full refund within 14 days of your purchase date, no
                questions asked. If DBundone doesn&apos;t fit your workflow or
                doesn&apos;t meet your expectations, we&apos;ll refund your
                payment in full.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                How to Request a Refund
              </h2>
              <p className="mb-3">
                Send an email to{" "}
                <a
                  href="mailto:support@dbundone.com"
                  className="text-primary hover:underline"
                >
                  support@dbundone.com
                </a>{" "}
                with the subject line &quot;Refund Request&quot; and include:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>The email address you used for purchase</li>
                <li>Your order number or Stripe receipt ID</li>
                <li>
                  Reason for refund (optional, but helps us improve the product)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Processing Time
              </h2>
              <p>
                Refunds are processed within 3-5 business days. The refund will
                be issued to the original payment method via Stripe. Depending
                on your bank, it may take an additional 5-10 business days to
                appear on your statement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                After the 14-Day Window
              </h2>
              <p>
                Refund requests made after 14 days will be reviewed on a
                case-by-case basis. We want every customer to be satisfied, so
                please reach out even if you&apos;re past the window — we&apos;ll
                do our best to help.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                License Revocation
              </h2>
              <p>
                Upon receiving a refund, your Pro license will be revoked and
                your account will revert to the free tier. Your local data and
                projects are not affected — they remain on your machine.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Contact
              </h2>
              <p>
                Questions about refunds? Reach us at{" "}
                <a
                  href="mailto:support@dbundone.com"
                  className="text-primary hover:underline"
                >
                  support@dbundone.com
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
