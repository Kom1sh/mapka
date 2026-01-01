import Header from "@/components/Header";
import BlogPageClient from "./BlogPageClient";
import "./blog.css";

export const metadata = {
  title: "Блог Мапка - Статьи, подборки секций и советы для родителей",
  description:
    "Полезные статьи для родителей: как выбрать кружок, подборки лучших секций Ростова-на-Дону, советы психологов и тренеров.",
  alternates: {
    canonical: "https://xn--80aa3agq.xn--p1ai/blog",
  },
  openGraph: {
    title: "Блог Мапка - Статьи и подборки",
    description: "Все о детском досуге и образовании.",
    type: "website",
    images: ["/og-image.jpg"],
  },
};

export default function BlogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Блог Мапка",
    description: "Полезные статьи и подборки кружков для родителей",
    url: "https://xn--80aa3agq.xn--p1ai/blog",
    publisher: {
      "@type": "Organization",
      name: "Мапка",
      logo: {
        "@type": "ImageObject",
        url: "https://xn--80aa3agq.xn--p1ai/logo.png",
      },
    },
    blogPost: [
      {
        "@type": "BlogPosting",
        headline: "Топ-10 футбольных секций Ростова-на-Дону",
        image: "https://images.unsplash.com/photo-1542315264-884813583226",
        datePublished: "2025-10-25",
        author: { "@type": "Person", name: "Анна Иванова" },
      },
      {
        "@type": "BlogPosting",
        headline: "Как понять, что ребенку не подходит кружок?",
        image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9",
        datePublished: "2025-10-20",
        author: { "@type": "Person", name: "Олег Петров" },
      },
    ],
  };

  return (
    <>
      <Header />
      <BlogPageClient />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
