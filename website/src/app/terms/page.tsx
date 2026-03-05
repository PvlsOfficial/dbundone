import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "DBundone terms of service and end-user license agreement.",
  alternates: { canonical: "https://dbundone.com/terms" },
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <article className="mx-auto max-w-[680px] px-6">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Last updated: March 1, 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted-foreground leading-[1.75]">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By downloading, installing, or using DBundone (&quot;the
                Software&quot;), you agree to be bound by these Terms of
                Service. If you do not agree, do not use the Software.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                2. License
              </h2>
              <p className="mb-3">
                <strong className="text-foreground">Free Tier:</strong> You are
                granted a free, non-exclusive, non-transferable license to use
                the Software with the limitations of the free tier (up to 25
                projects, 3 audio versions per project).
              </p>
              <p>
                <strong className="text-foreground">Pro License:</strong> Upon
                purchase, you are granted a perpetual, non-exclusive,
                non-transferable license to use the full Software on up to 2
                devices owned by you. This license is for personal or
                professional use and is non-redistributable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                3. Restrictions
              </h2>
              <p>You may not:</p>
              <ul className="list-disc pl-5 space-y-1.5 mt-2">
                <li>Reverse engineer, decompile, or disassemble the Software</li>
                <li>Redistribute, sublicense, or resell the Software</li>
                <li>
                  Use the Software for any unlawful purpose or in violation of
                  any applicable laws
                </li>
                <li>
                  Remove or alter any proprietary notices or labels on the
                  Software
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                4. Intellectual Property
              </h2>
              <p>
                The Software, including its code, design, and documentation, is
                the intellectual property of DBundone. Your purchase grants you
                a license to use the Software, not ownership of the Software
                itself. Your music, projects, and creative content remain
                entirely yours.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                5. Updates
              </h2>
              <p>
                Pro license holders receive all future updates to the Software
                at no additional cost. We reserve the right to release major
                version upgrades (e.g., DBundone 2.0) as separate products,
                though we will offer discounted upgrade pricing to existing
                customers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                6. Disclaimer of Warranties
              </h2>
              <p>
                The Software is provided &quot;as is&quot; without warranty of
                any kind, express or implied. We do not warrant that the
                Software will be error-free or uninterrupted. We are not
                responsible for any loss of data resulting from the use of the
                Software. Always maintain backups of your important files.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                7. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, DBundone shall not be
                liable for any indirect, incidental, special, consequential, or
                punitive damages arising from your use of the Software. Our
                total liability shall not exceed the amount you paid for the
                Software.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                8. Termination
              </h2>
              <p>
                We may terminate your license if you violate these Terms. Upon
                termination, you must cease all use of the Software and delete
                all copies. Your local data remains yours regardless of
                termination.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                9. Changes to Terms
              </h2>
              <p>
                We may update these Terms from time to time. Continued use of
                the Software after changes constitutes acceptance of the new
                Terms. We will notify users of significant changes via email or
                in-app notification.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                10. Contact
              </h2>
              <p>
                For questions about these Terms, contact us at{" "}
                <a
                  href="mailto:legal@dbundone.com"
                  className="text-primary hover:underline"
                >
                  legal@dbundone.com
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
