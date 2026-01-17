import Header from "@/components/Header";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
// В проекте body/html имеют overflow:hidden (app-style), поэтому делаем скролл через .blog-scroll
import "../blog.css";

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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mdInline(s) {
  // ссылки [text](url)
  let out = String(s || "");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, text, url) => {
    const safeText = escapeHtml(text);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  });

  // жирный **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, (m, t) => `<strong>${escapeHtml(t)}</strong>`);
  // курсив *text*
  out = out.replace(/\*([^*]+)\*/g, (m, t) => `<em>${escapeHtml(t)}</em>`);

  return out;
}

function markdownToHtml(md) {
  const src = String(md || "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");

  const out = [];
  let list = null;

  const flushList = () => {
    if (list && list.length) {
      out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("#### ")) {
      flushList();
      out.push(`<h4>${mdInline(line.slice(5).trim())}</h4>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      out.push(`<h3>${mdInline(line.slice(4).trim())}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      out.push(`<h2>${mdInline(line.slice(3).trim())}</h2>`);
      continue;
    }
    // Часто люди пишут одинарный # как «раздел». Внутри статьи это логичнее считать h2.
    if (line.startsWith("# ")) {
      flushList();
      out.push(`<h2>${mdInline(line.slice(2).trim())}</h2>`);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!list) list = [];
      list.push(mdInline(line.slice(2).trim()));
      continue;
    }

    flushList();
    out.push(`<p>${mdInline(line)}</p>`);
  }

  flushList();
  return out.join("\n");
}

function buildTocAndHtml(html) {
  if (!html || typeof html !== "string") return { toc: [], html: "" };

  const toc = [];
  let idx = 0;

  // h2/h3/h4 -> оглавление + добавляем id, если его нет
  const re = /<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/gi;

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

  const publishedAt = post.published_at || post.created_at || null;
  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const rawContent = post.content ?? "";
  const htmlSource = isHtml(rawContent)
    ? String(rawContent)
    : markdownToHtml(String(rawContent));
  const { toc, html } = buildTocAndHtml(htmlSource);

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

  return (
    <div className={styles.wrapper}>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="blog-scroll">
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
                      className={
                        styles[
                          i.level === 2 ? "lvl2" : i.level === 3 ? "lvl3" : "lvl4"
                        ]
                      }
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
                {rawContent || ""}
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

          </article>

          <aside className={styles.sidebar}>
            {toc.length > 0 ? (
              <div className={styles.tocBox}>
                <div className={styles.tocTitle}>Содержание</div>
                <ul className={styles.tocList}>
                  {toc.map((i) => (
                    <li
                      key={i.id}
                      className={
                        styles[
                          i.level === 2 ? "lvl2" : i.level === 3 ? "lvl3" : "lvl4"
                        ]
                      }
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
    </div>
  );
}
