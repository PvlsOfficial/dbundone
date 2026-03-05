import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Security headers — applied to ALL responses
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("X-Download-Options", "noopen");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
    "frame-src https://checkout.stripe.com https://js.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // CSRF protection for API routes (except webhooks)
  if (pathname.startsWith("/api/") && pathname !== "/api/webhook") {
    const origin = request.headers.get("origin");
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Block requests from different origins
    if (origin && !origin.startsWith(siteUrl)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Require POST for checkout
    if (
      pathname === "/api/checkout" &&
      request.method !== "POST"
    ) {
      return NextResponse.json(
        { error: "Method not allowed." },
        { status: 405 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files, _next internals, and public assets
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
