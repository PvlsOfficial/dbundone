import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getAllPosts } from "@/lib/blog";
import { ArrowRight, Calendar, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Tips, guides, and insights for music producers. Learn about FL Studio workflows, audio version control, LUFS metering, and production management.",
  alternates: {
    canonical: "https://dbundone.com/blog",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-[800px] px-6">
          <div className="mb-16">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] mb-3">
              Blog
            </h1>
            <p className="text-muted-foreground text-lg">
              Guides and insights for music producers.
            </p>
          </div>

          <div className="space-y-1">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-xl p-5 -mx-5 hover:bg-card/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold mb-1.5 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                      {post.description}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readingTime}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                </div>
              </Link>
            ))}

            {posts.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No posts yet. Check back soon.
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
