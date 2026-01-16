import Header from "@/components/Header";
import BlogPageClient from "./BlogPageClient";
import "./blog.css";

// В проде /blog может падать из-за вычисления base url через headers()/proxy.
// Делаем страницу динамической и берём SITE_URL из env (или фоллбек), без headers().
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_SITE_URL = "https://xn--80aa3agq.xn--p1ai";

const SITE_URL = String(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || FALLBACK_SITE_URL
).replace(/\/+$/, "");

export const metadata = {
  title: "Блог Мапка - Статьи, подборки секций и советы для родителей",
  description:
    "Полезные статьи для родителей: как выбрать кружок, подборки лучших секций Ростова-на-Дону, советы психологов и тренеров.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: "Блог Мапка - Статьи и подборки",
    description: "Все о детском досуге и образовании.",
    type: "website",
    url: `${SITE_URL}/blog`,
    images: [
      {
        url: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Блог Мапка",
      },
    ],
  },
};

async function fetchPublicPosts() {
  try {
    const r = await fetch(`${SITE_URL}/api/blog/public/posts?limit=200`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const data = await r.json();

    // На всякий случай поддержим оба формата ответа:
    // 1) массив постов
    // 2) объект { items: [...] }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;

    return [];
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await fetchPublicPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Блог Мапка",
    description: "Полезные статьи и подборки кружков для родителей",
    url: `${SITE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Мапка",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    blogPost: posts.slice(0, 20).map((p) => ({
      "@type": "BlogPosting",
      headline: p?.title || "",
      image: p?.cover_image || undefined,
      datePublished: p?.published_at || p?.created_at || undefined,
      author: { "@type": "Person", name: p?.author_name || "Редакция Мапка" },
      url: `${SITE_URL}/blog/${p?.slug || ""}`,
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
