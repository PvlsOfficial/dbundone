import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Purchase Successful",
  robots: { index: false, follow: false },
};

export default function SuccessPage() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-[500px] px-6 text-center">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 mb-6">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            Thank you for your purchase!
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Your DBundone Pro license is ready. Check your email for your
            license key and download links.
          </p>

          <div className="space-y-3">
            <Button
              asChild
              size="lg"
              className="w-full h-11 bg-primary hover:bg-primary/90"
            >
              <Link href="/download">
                <Download className="mr-2 h-4 w-4" />
                Download DBundone
              </Link>
            </Button>
          </div>

          <div className="mt-8 rounded-lg border border-border/50 bg-card/30 p-4">
            <div className="flex items-start gap-3 text-left">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-0.5">
                  Check your inbox
                </p>
                <p className="text-[13px] text-muted-foreground">
                  We&apos;ve sent your license key and receipt to the email you
                  used at checkout. If you don&apos;t see it, check your spam
                  folder.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground/50">
            Need help?{" "}
            <a
              href="mailto:support@dbundone.com"
              className="text-primary hover:underline"
            >
              support@dbundone.com
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
