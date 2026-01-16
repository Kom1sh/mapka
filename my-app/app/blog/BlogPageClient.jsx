"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_PUBLIC_LIST = "/api/blog/public/posts?limit=200";

function stripHtml(html) {
  const s = String(html || "");
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDateRu(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function calcReadTime(html) {
  const text = stripHtml(html);
  const words = text ? text.split(/\s+/).length : 0;
  const min = Math.max(1, Math.ceil(words / 200));
  return `${min} мин. читать`;
}

export default function BlogPageClient({ initialPosts = [] }) {
  const [posts, setPosts] = useState(Array.isArray(initialPosts) ? initialPosts : []);
  const [activeCategory, setActiveCategory] = useState("Все");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Refetch on mount (so changes from admin are visible without redeploy)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const r = await fetch(API_PUBLIC_LIST, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!alive) return;
        setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr("Не удалось загрузить статьи. Попробуйте обновить страницу.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of posts) {
      const c = (p?.category || "").trim();
      if (c) set.add(c);
    }
    return ["Все", ...Array.from(set).slice(0, 10)];
  }, [posts]);

  const filtered = useMemo(() => {
    if (activeCategory === "Все") return posts;
    return posts.filter((p) => (p?.category || "") === activeCategory);
  }, [posts, activeCategory]);

  const cards = useMemo(() => {
    return filtered.map((p, idx) => {
      const dateIso = p?.published_at || p?.created_at;
      const readTime = p?.read_time || calcReadTime(p?.content);
      const excerpt = (p?.excerpt || "").trim() || stripHtml(p?.content).slice(0, 180);
      return {
        featured: activeCategory === "Все" && idx === 0,
        category: (p?.category || "Статья").trim() || "Статья",
        image: p?.cover_image || "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop",
        imageAlt: p?.title || "",
        dateISO: dateIso || "",
        dateLabel: formatDateRu(dateIso),
        readTime,
        title: p?.title || "",
        excerpt,
        authorName: p?.author_name || "Редакция Мапка",
        authorImg: p?.author_avatar || "https://i.pravatar.cc/100?img=33",
        href: `/blog/${p?.slug || ""}`,
      };
    });
  }, [filtered, activeCategory]);

  const onNewsletterSubmit = (e) => {
    e.preventDefault();
    alert("Спасибо за подписку!");
  };

  return (
    <div className="blog-scroll">
      <main className="blog-container">
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Главная</Link>
          <span className="separator">/</span>
          <span aria-current="page">Блог</span>
        </nav>

        {/* Blog Header */}
        <section className="blog-header">
          <h1 className="blog-title">Полезное для родителей</h1>
          <p className="blog-subtitle">
            Подборки лучших секций, советы психологов, новости образования и идеи
            для развития вашего ребенка.
          </p>
        </section>

        {/* Filter/Tags */}
        <div className="blog-tags">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`category-btn ${c === activeCategory ? "active" : ""}`}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {err ? <div style={{ color: "#b91c1c", margin: "10px 0" }}>{err}</div> : null}
        {loading && cards.length === 0 ? <div style={{ opacity: 0.7 }}>Загрузка…</div> : null}

        {/* Grid */}
        <div className="articles-grid">
          {cards.map((a, idx) => (
            <article
              key={`${a.title}-${idx}`}
              className={`article-card ${a.featured ? "featured" : ""}`}
            >
              <div className="card-img-wrapper">
                <span className="card-category">{a.category}</span>
                <img src={a.image} alt={a.imageAlt} loading="lazy" />
              </div>

              <div className="card-content">
                <div className="card-meta">
                  <time dateTime={a.dateISO}>{a.dateLabel}</time>
                  <span>• {a.readTime}</span>
                </div>

                <Link href={a.href}>
                  {/* Чтобы не было “H1 + только H3”, делаем заголовки статей H2 */}
                  <h2 className="card-title">{a.title}</h2>
                </Link>

                <p className="card-excerpt">{a.excerpt}</p>

                <div className="card-footer">
                  <div className="author">
                    <img
                      src={a.authorImg}
                      alt={a.authorName}
                      className="author-img"
                    />
                    <span className="author-name">{a.authorName}</span>
                  </div>

                  {a.featured ? (
                    <Link href={a.href} className="read-more">
                      Читать далее &rarr;
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Newsletter */}
        <section className="newsletter">
          {/* В макете было h3 — делаем h2, чтобы структура была чище */}
          <h2>Подпишитесь на полезные советы</h2>
          <p>
            Каждую неделю присылаем подборку лучших кружков и идеи для выходных с
            детьми.
          </p>

          <form className="newsletter-form" onSubmit={onNewsletterSubmit}>
            <input
              type="email"
              placeholder="Ваш Email"
              className="newsletter-input"
              required
            />
            <button type="submit" className="newsletter-btn">
              Подписаться
            </button>
          </form>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <img
            src="/logo.png"
            alt="Мапка"
            className="footer-logo"
            loading="lazy"
          />
          <div className="copyright">© 2026 Мапка. Все права защищены.</div>
          <div className="footer-links">
            <a href="#">Политика конфиденциальности</a>
            <a href="#">Оферта</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
