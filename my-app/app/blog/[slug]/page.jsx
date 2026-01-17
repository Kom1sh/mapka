import Header from "@/components/Header";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

// Динамический slug, без статического пререндеринга
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = "https://xn--80aa3agq.xn--p1ai";
const SITE_NAME = "Мапка.рф";

// Паттерн API_BASE, чтобы совпадать с остальным фронтом
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

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  let data = faq;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  // { items: [...] }
  if (data && !Array.isArray(data) && Array.isArray(data.items)) {
    data = data.items;
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((x) => ({
      q: x?.q ?? x?.question ?? x?.title ?? "",
      a: x?.a ?? x?.answer ?? x?.text ?? "",
    }))
    .map((x) => ({ q: String(x.q || "").trim(), a: String(x.a || "").trim() }))
    .filter((x) => x.q && x.a);
}

function renderInlineMd(text) {
  let s = escapeHtml(text);

  // links: [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>'
  );

  // bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // italic: *text*
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return s;
}

function markdownToHtml(md) {
  const src = String(md || "").replace(/\r\n?/g, "\n");
  const lines = src.split("\n");

  const out = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    // headings: # / ## / ### / ####
    const hm = trimmed.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (hm) {
      closeList();
      const n = hm[1].length;
      const lvl = Math.min(Math.max(n, 2), 4); // h2..h4
      out.push(`<h${lvl}>${renderInlineMd(hm[2])}</h${lvl}>`);
      continue;
    }

    // bullet list: - item / * item
    const lm = trimmed.match(/^[-*]\s+(.+)$/);
    if (lm) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${renderInlineMd(lm[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${renderInlineMd(trimmed)}</p>`);
  }

  closeList();
  return out.join("\n");
}

function buildTocAndHtml(html) {
  if (!html || typeof html !== "string") return { toc: [], html: "" };

  const toc = [];
  let idx = 0;

  // h2/h3/h4 -> оглавление + добавляем id, если его нет
  const re = /<h([234])([^>]*)>([\s\S]*?)<\/h\1>/gi;

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
    console.error("[blog/[slug]] internal fetch failed:", e);
  }

  // 2) Фолбэк на публичный домен
  return fetchJson(`${API_BASE}/blog/public/posts/${encoded}`, {
    cache: "no-store",
  });
}

export async function generateMetadata({ params }) {
  // В проекте params = Promise
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
  // В проекте params = Promise
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

  const htmlContent = isHtml(post.content)
    ? String(post.content)
    : markdownToHtml(post.content || "");

  const { toc: rawToc, html } = buildTocAndHtml(htmlContent);
  const toc = faq.length > 0
    ? [...rawToc, { id: "faq", title: "Частые вопросы", level: 2 }]
    : rawToc;

  const faqItems = faq.map((x) => {
    const aHtml = isHtml(x.a) ? String(x.a) : markdownToHtml(x.a);
    return { q: x.q, aHtml, aText: stripHtml(aHtml) };
  });

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
    faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((x) => ({
            "@type": "Question",
            name: x.q,
            acceptedAnswer: { "@type": "Answer", text: x.aText },
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

            {/* FAQ — самым последним блоком в статье */}
            {faqItems.length > 0 ? (
              <section id="faq" className={styles.faq}>
                <h2 className={styles.faqTitle}>Частые вопросы</h2>
                <div className={styles.faqList}>
                  {faqItems.map((x, idx) => (
                    <details key={idx} className={styles.faqItem}>
                      <summary className={styles.faqQ}>{x.q}</summary>
                      <div
                        className={styles.faqA}
                        dangerouslySetInnerHTML={{ __html: x.aHtml }}
                      />
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
