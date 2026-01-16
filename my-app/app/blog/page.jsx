import Header from "@/components/Header";
import BlogPageClient from "./BlogPageClient";
import "./blog.css";
import { headers } from "next/headers";

const FALLBACK_SITE_URL = "https://xn--80aa3agq.xn--p1ai";

export const metadata = {
  title: "Блог Мапка - Статьи, подборки секций и советы для родителей",
  description:
    "Полезные статьи для родителей: как выбрать кружок, подборки лучших секций Ростова-на-Дону, советы психологов и тренеров.",
  alternates: {
    canonical: `${FALLBACK_SITE_URL}/blog`,
  },
  openGraph: {
    title: "Блог Мапка - Статьи и подборки",
    description: "Все о детском досуге и образовании.",
    type: "website",
    images: ["/og-image.jpg"],
  },
};

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (!host) return FALLBACK_SITE_URL;
  return `${proto}://${host}`;
}

async function fetchPublicPosts() {
  const base = getBaseUrl();
  try {
    const r = await fetch(`${base}/api/blog/public/posts?limit=200`, {
      next: { revalidate: 60 },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const base = getBaseUrl();
  const posts = await fetchPublicPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Блог Мапка",
    description: "Полезные статьи и подборки кружков для родителей",
    url: `${base}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Мапка",
      logo: {
        "@type": "ImageObject",
        url: `${base}/logo.png`,
      },
    },
    blogPost: posts.slice(0, 20).map((p) => ({
      "@type": "BlogPosting",
      headline: p?.title || "",
      image: p?.cover_image || undefined,
      datePublished: p?.published_at || p?.created_at || undefined,
      author: { "@type": "Person", name: p?.author_name || "Редакция Мапка" },
      url: `${base}/blog/${p?.slug || ""}`,
    })),
  };

  return (
    <>
      <Header />
      <BlogPageClient initialPosts={posts} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
