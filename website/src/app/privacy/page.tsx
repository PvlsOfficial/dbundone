import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "DBundone privacy policy. How we handle your data.",
  alternates: { canonical: "https://dbundone.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <article className="mx-auto max-w-[680px] px-6">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: March 1, 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted-foreground leading-[1.75]">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Overview
              </h2>
              <p>
                DBundone is a desktop application for music production management.
                We are committed to protecting your privacy. This policy explains
                what data we collect, how we use it, and your rights.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Data We Collect
              </h2>
              <p className="mb-3">
                <strong className="text-foreground">Desktop App:</strong> The
                DBundone desktop application stores all data locally on your
                machine in a SQLite database. We do not have access to your
                projects, audio files, DAW data, or any production content. No
                data is transmitted to our servers from the desktop app unless you
                explicitly use cloud collaboration features.
              </p>
              <p className="mb-3">
                <strong className="text-foreground">Website:</strong> When you
                visit dbundone.com, we may collect standard web analytics data
                (page views, referral source, country) using privacy-respecting
                analytics. We do not use invasive tracking or sell your data to
                third parties.
              </p>
              <p>
                <strong className="text-foreground">Purchases:</strong> Payment
                processing is handled entirely by Stripe. We do not store your
                credit card information. Stripe&apos;s privacy policy applies to
                payment data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Cloud Collaboration (Optional)
              </h2>
              <p>
                If you choose to use cloud collaboration features, project
                metadata and audio versions you explicitly share are stored on
                our servers (powered by Supabase). You control what is shared and
                can revoke access at any time. We do not access, analyze, or use
                your shared content for any purpose other than providing the
                collaboration service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Cookies
              </h2>
              <p>
                Our website uses only essential cookies required for
                functionality (e.g., checkout sessions). We do not use
                advertising cookies or third-party tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Your Rights
              </h2>
              <p>
                You have the right to access, correct, or delete any personal
                data we hold. Since the desktop app stores data locally, you have
                full control over your data at all times. For cloud
                collaboration data or account-related requests, contact us at{" "}
                <a
                  href="mailto:privacy@dbundone.com"
                  className="text-primary hover:underline"
                >
                  privacy@dbundone.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Third-Party Services
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Stripe</strong> — Payment
                  processing. See{" "}
                  <a
                    href="https://stripe.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Stripe&apos;s Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <strong className="text-foreground">Supabase</strong> — Cloud
                  collaboration backend (optional). See{" "}
                  <a
                    href="https://supabase.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Supabase&apos;s Privacy Policy
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Changes to This Policy
              </h2>
              <p>
                We may update this policy from time to time. Significant changes
                will be communicated via our website and in-app notifications.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Contact
              </h2>
              <p>
                For privacy-related questions, contact us at{" "}
                <a
                  href="mailto:privacy@dbundone.com"
                  className="text-primary hover:underline"
                >
                  privacy@dbundone.com
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
