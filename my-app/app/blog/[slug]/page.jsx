import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { ChevronRight, List, ChevronDown } from "lucide-react";
import { headers } from "next/headers";

const SITE_NAME = "Мапка.рф";
const FALLBACK_SITE_URL = "https://xn--80aa3agq.xn--p1ai";

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (!host) return FALLBACK_SITE_URL;
  return `${proto}://${host}`;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyBasic(text) {
  const s = String(text || "").toLowerCase().trim();
  let out = "";
  let dash = false;
  for (const ch of s) {
    const ok = /[a-z0-9а-яё]/i.test(ch);
    if (ok) {
      out += ch;
      dash = false;
    } else if (!dash) {
      out += "-";
      dash = true;
    }
  }
  out = out.replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  return out || "section";
}

function buildTocAndInjectIds(html) {
  const used = new Map();
  const toc = [];

  const replaced = String(html || "").replace(
    /<h([2-3])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, level, attrs, inner) => {
      const levelNum = Number(level);
      const text = stripHtml(inner);
      if (!text) return full;

      let idMatch = String(attrs || "").match(/\sid\s*=\s*(["'])([^"']+)\1/i);
      let id = idMatch ? idMatch[2] : "";
      if (!id) {
        id = slugifyBasic(text);
      }

      // unique
      const count = used.get(id) || 0;
      used.set(id, count + 1);
      if (count > 0) id = `${id}-${count + 1}`;

      toc.push({ id, title: text, level: levelNum });

      // inject id if missing
      let newAttrs = String(attrs || "");
      if (!/\sid\s*=\s*/i.test(newAttrs)) {
        newAttrs = `${newAttrs} id="${id}"`;
      }

      return `<h${level}${newAttrs}>${inner}</h${level}>`;
    }
  );

  return { html: replaced, toc };
}

async function fetchPost(slug) {
  const base = getBaseUrl();
  const r = await fetch(`${base}/api/blog/public/posts/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!r.ok) return null;
  return r.json();
}

export async function generateMetadata({ params }) {
  const post = await fetchPost(params.slug);
  if (!post) return { title: "Статья не найдена" };
  const base = getBaseUrl();

  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.excerpt || "",
    alternates: { canonical: `${base}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      url: `${base}/blog/${post.slug}`,
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "article",
      images: post.cover_image
        ? [{ url: post.cover_image, width: 1200, height: 630, alt: post.title }]
        : undefined,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  const { html: contentHtml, toc } = buildTocAndInjectIds(post.content || "");
  const dateIso = post.published_at || post.created_at;

  const dateStr = dateIso
    ? new Date(dateIso).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    image: post.cover_image ? [post.cover_image] : undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    description: post.excerpt || undefined,
    author: { "@type": "Person", name: post.author_name || "Редакция Мапка" },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${getBaseUrl()}/logo.png` },
    },
  };

  const tocItems = toc.length
    ? toc
    : [{ id: "content", title: "Статья", level: 2 }];

  const faq = Array.isArray(post.faq) ? post.faq : [];

  return (
    <div className={styles.wrapper}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className={styles.container}>
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span style={{ color: "#0f172a", fontWeight: 500 }}>
            {post.title}
          </span>
        </nav>

        <div className={styles.grid}>
          {/* === 1. СТАТЬЯ === */}
          <article className={styles.article}>
            <span className={styles.badge}>{post.category || "Статья"}</span>
            <h1 className={styles.h1}>{post.title}</h1>

            <div className={styles.authorRow}>
              {post.author_avatar ? (
                <img
                  src={post.author_avatar}
                  alt={post.author_name || "Автор"}
                  width={48}
                  height={48}
                  className={styles.avatar}
                  loading="lazy"
                />
              ) : (
                <div className={styles.avatar} />
              )}
              <div className={styles.metaText}>
                <strong>{post.author_name || "Редакция Мапка"}</strong>
                <span>
                  {(post.author_role || "").trim()}
                  {(post.author_role || "").trim() && dateStr ? " • " : ""}
                  {dateStr}
                </span>
              </div>
            </div>

            {post.cover_image ? (
              <div className={styles.coverWrapper}>
                <img
                  src={post.cover_image}
                  alt={post.title}
                  className={styles.cover}
                  loading="eager"
                />
              </div>
            ) : null}

            {/* Мобильное оглавление */}
            <div className={styles.mobileToc}>
              <h2 className={styles.tocTitle}>
                <List size={18} /> Содержание
              </h2>
              <ul className={styles.tocList}>
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={styles.tocLink}>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </article>

          {/* === 2. САЙДБАР === */}
          <aside>
            <div className={styles.desktopToc}>
              <div className={styles.tocTitle}>
                <List size={18} /> Содержание
              </div>
              <ul className={styles.tocList}>
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={styles.tocLink}>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>

              <div className={styles.promoBox}>
                <h2 className={styles.promoTitle}>Подбор кружка</h2>
                <p style={{ fontSize: "13px", color: "#4b5563" }}>
                  Найдите секции рядом с домом на карте Мапки.
                </p>
                <Link href="/" className={styles.promoBtn}>
                  Открыть карту
                </Link>
              </div>
            </div>
          </aside>

          {/* === 3. FAQ (в самом низу) === */}
          {faq.length ? (
            <div id="faq" className={styles.faqSection}>
              <h2 className={styles.faqTitle}>Частые вопросы</h2>
              {faq.map((item, index) => (
                <details key={index} className={styles.faqItem}>
                  <summary className={styles.faqSummary}>
                    {item.q} <ChevronDown size={16} />
                  </summary>
                  <div className={styles.faqDetails}>{item.a}</div>
                </details>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
