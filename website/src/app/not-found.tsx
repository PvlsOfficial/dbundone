import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-[400px] px-6 text-center">
          <p className="text-6xl font-bold text-muted-foreground/20 mb-4">
            404
          </p>
          <h1 className="text-xl font-semibold mb-2">Page not found</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              Back to home
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
