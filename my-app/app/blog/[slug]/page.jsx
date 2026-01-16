import Header from "@/components/Header";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

// Для динамического slug и чтобы не попасть в статический пререндер
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Основной домен сайта (punycode) — как в других страницах проекта
const SITE_URL = "https://xn--80aa3agq.xn--p1ai";
const SITE_NAME = "Мапка.рф";

// ✅ Паттерн API_BASE совпадает с lib/club-api.js
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  `${SITE_URL}/api`;

// Внутренний origin, чтобы SSR не зависел от внешнего https/dns
const INTERNAL_API_ORIGIN =
  process.env.INTERNAL_API_ORIGIN || "http://127.0.0.1:8000";

function isHtml(s) {
  const str = String(s || "").trim();
  return /<\w+[\s\S]*?>/.test(str);
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "").trim();
}

function slugify(text) {
  return stripHtml(text)
    .toLowerCase()
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/[^A-zА-яЁё\d]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean).map(String);
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function normalizeFaq(faq) {
  if (!faq) return [];
  if (Array.isArray(faq)) {
    return faq
      .map((x) => ({
        q: x?.q ?? x?.question ?? "",
        a: x?.a ?? x?.answer ?? "",
      }))
      .filter((x) => x.q && x.a);
  }
  return [];
}

function buildTocAndHtml(html) {
  if (!html || typeof html !== "string") return { toc: [], html: "" };

  const toc = [];
  let idx = 0;

  // h2/h3 -> оглавление + добавляем id, если его нет
  const re = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi;

  const withIds = html.replace(re, (full, level, attrs, inner) => {
    idx += 1;
    const title = stripHtml(inner);
    const m = String(attrs).match(/\sid=["']([^"']+)["']/i);
    const existingId = m?.[1];
    const id = existingId || slugify(title) || `section-${idx}`;

    toc.push({ id, title, level: Number(level) });

    if (existingId) return full;
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });

  return { toc, html: withIds };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}: ${txt}`);
  }
  return res.json();
}

async function fetchPost(slug) {
  const encoded = encodeURIComponent(String(slug || "").trim());
  if (!encoded) return null;

  // 1) Сначала пробуем внутренний backend (быстрее и без редиректов/ssl)
  try {
    return await fetchJson(
      `${INTERNAL_API_ORIGIN}/api/blog/public/posts/${encoded}`,
      { cache: "no-store" }
    );
  } catch (e) {
    // Лог оставляем — очень помогает при SSR
    console.error("[blog/[slug]] internal fetch failed:", e);
  }

  // 2) Фолбэк на публичный домен
  try {
    return await fetchJson(`${API_BASE}/blog/public/posts/${encoded}`, {
      cache: "no-store",
    });
  } catch (e) {
    console.error("[blog/[slug]] public fetch failed:", e);
    throw e;
  }
}

export async function generateMetadata({ params }) {
  // ✅ В твоём проекте params — Promise (см. app/[slug]/page.jsx)
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  const post = await fetchPost(slug).catch(() => null);
  if (!post) {
    return {
      title: `Статья не найдена | Блог ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${SITE_URL}/blog/${post.slug}`;
  const ogImage = post.cover_image || `${SITE_URL}/og-image.jpg`;

  return {
    title: `${post.title} | Блог ${SITE_NAME}`,
    description: post.excerpt || "",
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      url: canonical,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({ params }) {
  // ✅ В твоём проекте params — Promise
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  const post = await fetchPost(slug).catch(() => null);
  if (!post) notFound();

  const tags = normalizeTags(post.tags);
  const faq = normalizeFaq(post.faq);

  const publishedAt = post.published_at || post.created_at || null;
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const htmlContent = isHtml(post.content) ? String(post.content) : "";
  const { toc, html } = buildTocAndHtml(htmlContent);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: publishedAt || undefined,
    dateModified: post.updated_at || publishedAt || undefined,
    description: post.excerpt || "",
    author: {
      "@type": "Person",
      name: post.author_name || "Редакция Мапка",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  const faqJsonLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((x) => ({
            "@type": "Question",
            name: x.q,
            acceptedAnswer: { "@type": "Answer", text: x.a },
          })),
        }
      : null;

  return (
    <div className={styles.wrapper}>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <main className={styles.container}>
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <span className={styles.sep}>/</span>
          <Link href="/blog">Блог</Link>
          <span className={styles.sep}>/</span>
          <span className={styles.current}>{post.title}</span>
        </nav>

        <div className={styles.grid}>
          <article className={styles.article}>
            <div className={styles.header}>
              {post.category ? (
                <span className={styles.badge}>{post.category}</span>
              ) : null}

              <h1 className={styles.h1}>{post.title}</h1>

              <div className={styles.meta}>
                <div className={styles.metaLeft}>
                  {post.author_avatar ? (
                    <img
                      src={post.author_avatar}
                      alt={post.author_name || "Автор"}
                      className={styles.avatar}
                      loading="lazy"
                    />
                  ) : null}

                  <div className={styles.metaText}>
                    <div className={styles.authorName}>
                      {post.author_name || "Редакция Мапка"}
                    </div>
                    <div className={styles.authorSub}>
                      {post.author_role ? `${post.author_role} • ` : ""}
                      {dateStr}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {post.cover_image ? (
              <div className={styles.coverWrap}>
                <img
                  src={post.cover_image}
                  alt={post.title}
                  className={styles.cover}
                  loading="eager"
                />
              </div>
            ) : null}

            {toc.length > 0 ? (
              <div className={styles.mobileToc}>
                <div className={styles.tocTitle}>Содержание</div>
                <ul className={styles.tocList}>
                  {toc.map((i) => (
                    <li
                      key={i.id}
                      className={styles[i.level === 2 ? "lvl2" : "lvl3"]}
                    >
                      <a href={`#${i.id}`} className={styles.tocLink}>
                        {i.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {html ? (
              <div
                className={styles.content}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className={styles.content} style={{ whiteSpace: "pre-wrap" }}>
                {post.content || ""}
              </div>
            )}

            {tags.length > 0 ? (
              <div className={styles.tags}>
                {tags.map((t) => (
                  <Link
                    key={t}
                    href={`/blog?tag=${encodeURIComponent(t)}`}
                    className={styles.tag}
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            ) : null}

            {faq.length > 0 ? (
              <section id="faq" className={styles.faq}>
                <h2 className={styles.faqTitle}>Частые вопросы</h2>
                <div className={styles.faqList}>
                  {faq.map((x, idx) => (
                    <details key={idx} className={styles.faqItem}>
                      <summary className={styles.faqQ}>{x.q}</summary>
                      <div className={styles.faqA}>{x.a}</div>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className={styles.sidebar}>
            {toc.length > 0 ? (
              <div className={styles.tocBox}>
                <div className={styles.tocTitle}>Содержание</div>
                <ul className={styles.tocList}>
                  {toc.map((i) => (
                    <li
                      key={i.id}
                      className={styles[i.level === 2 ? "lvl2" : "lvl3"]}
                    >
                      <a href={`#${i.id}`} className={styles.tocLink}>
                        {i.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.promo}>
              <div className={styles.promoTitle}>Ищете кружок рядом?</div>
              <div className={styles.promoText}>
                Откройте карту секций и выберите лучшее по району и цене.
              </div>
              <Link className={styles.promoBtn} href="/">
                Открыть карту
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
