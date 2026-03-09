import Link from "next/link";
import { FOOTER_LINKS } from "@/lib/constants";
import { AppLogo } from "@/components/AppLogo";

export function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <AppLogo size={32} />
              <span className="text-sm font-semibold tracking-tight">
                DBundone
              </span>
            </Link>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed max-w-[200px]">
              Free and open source. Built for producers, by producers.
            </p>
          </div>

          {/* Link columns */}
          <FooterColumn title="Product" links={FOOTER_LINKS.product} />
          <FooterColumn title="Resources" links={FOOTER_LINKS.resources} />
          <FooterColumn title="Legal" links={FOOTER_LINKS.legal} />
          <FooterColumn title="Community" links={FOOTER_LINKS.social} />
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DBundone. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Windows & macOS &middot; FL Studio & Ableton Live
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60 mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              {...(link.href.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
