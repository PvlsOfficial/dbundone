import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { MDXContent } from "./MDXContent";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `https://dbundone.com/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="pt-32 pb-20">
        <article className="mx-auto max-w-[680px] px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to blog
          </Link>

          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-tight mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(post.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {post.readingTime}
              </span>
              <span>{post.author}</span>
            </div>
          </header>

          <MDXContent source={post.content} />

          {/* Blog post schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                description: post.description,
                datePublished: post.date,
                author: {
                  "@type": "Person",
                  name: post.author,
                },
                publisher: {
                  "@type": "Organization",
                  name: "DBundone",
                  url: "https://dbundone.com",
                },
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": `https://dbundone.com/blog/${slug}`,
                },
              }),
            }}
          />
        </article>
      </main>
      <Footer />
    </>
  );
}
