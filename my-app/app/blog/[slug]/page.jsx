import Header from "@/components/Header";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK_SITE_URL = "https://xn--80aa3agq.xn--p1ai";
const SITE_NAME = "Мапка.рф";

function normalizeOrigin(raw) {
  let s = String(raw || "").trim();
  if (!s) return FALLBACK_SITE_URL;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  try {
    const u = new URL(s);
    // u.host будет в ASCII (punycode) для доменов с кириллицей
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

const PUBLIC_ORIGIN = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || FALLBACK_SITE_URL
);

// Для SSR лучше уметь ходить в локальный reverse-proxy без DNS/SSL проблем.
// Если есть INTERNAL_API_ORIGIN (например http://127.0.0.1), используем его первым.
const API_ORIGINS = [
  process.env.INTERNAL_API_ORIGIN,
  PUBLIC_ORIGIN,
  "http://127.0.0.1",
  "http://localhost",
]
  .filter(Boolean)
  .map((o) => String(o).replace(/\/+$/, ""));

function absolutizeUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const u = String(url);
  if (u.startsWith("/")) return `${PUBLIC_ORIGIN}${u}`;
  return `${PUBLIC_ORIGIN}/${u}`;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, "").trim();
}

function slugify(text) {
  return stripHtml(text)
    .toLowerCase()
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
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

async function fetchJsonWithFallback(pathname) {
  let saw404 = false;
  let lastErr = null;

  for (const origin of API_ORIGINS) {
    const url = `${origin}${pathname}`;

    try {
      const r = await fetch(url, { cache: "no-store" });

      if (r.status === 404) {
        saw404 = true;
        continue; // возможно, это "не тот" origin — пробуем следующий
      }

      if (!r.ok) {
        lastErr = new Error(`Fetch failed ${r.status} for ${url}`);
        continue;
      }

      return await r.json();
    } catch (e) {
      lastErr = e;
      continue;
    }
  }

  if (saw404) return null;
  throw lastErr || new Error("Fetch failed");
}

async function fetchPublicPost(slug) {
  return fetchJsonWithFallback(
    `/api/blog/public/posts/${encodeURIComponent(slug)}`
  );
}

export async function generateMetadata({ params }) {
  try {
    const post = await fetchPublicPost(params.slug);
    if (!post) {
      return {
        title: `Статья не найдена | ${SITE_NAME}`,
        robots: { index: false, follow: false },
      };
    }

    const title = `${post.title} | Блог ${SITE_NAME}`;
    const description = post.excerpt || "";
    const canonical = `${PUBLIC_ORIGIN}/blog/${post.slug}`;
    const ogImage =
      absolutizeUrl(post.cover_image) || `${PUBLIC_ORIGIN}/og-image.jpg`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: SITE_NAME,
        locale: "ru_RU",
        type: "article",
        images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      },
    };
  } catch {
    // Если SSR не может сходить в API, лучше не 500, а noindex.
    return {
      title: `Блог | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    };
  }
}

export default async function BlogPostPage({ params }) {
  let post = null;

  try {
    post = await fetchPublicPost(params.slug);
  } catch (e) {
    // Логируем причину, чтобы видно было в journalctl/logs Next
    console.error("[blog/[slug]] SSR fetch failed:", e);
    notFound();
  }

  if (!post) notFound();

  const tags = normalizeTags(post.tags);
  const faq = normalizeFaq(post.faq);

  const { toc, html } = buildTocAndHtml(post.content || "");
  const cover = absolutizeUrl(post.cover_image);
  const publishedAt = post.published_at || post.created_at || null;
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  // JSON-LD: BlogPosting + FAQPage (если есть)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    image: cover ? [cover] : undefined,
    datePublished: publishedAt || undefined,
    dateModified: post.updated_at || publishedAt || undefined,
    author: {
      "@type": "Person",
      name: post.author_name || "Редакция Мапка",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${PUBLIC_ORIGIN}/logo.png` },
    },
    mainEntityOfPage: `${PUBLIC_ORIGIN}/blog/${post.slug}`,
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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

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
                      src={absolutizeUrl(post.author_avatar)}
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
                      {post.read_time ? ` • ${post.read_time}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {cover ? (
              <div className={styles.coverWrap}>
                <img
                  src={cover}
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
                    <li key={i.id} className={styles[`lvl${i.level}`]}>
                      <a href={`#${i.id}`} className={styles.tocLink}>
                        {i.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: html }}
            />

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
                    <li key={i.id} className={styles[`lvl${i.level}`]}>
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
