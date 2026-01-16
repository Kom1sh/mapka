"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const TAGS = ["Все", "Подборки", "Советы", "Спорт", "Творчество", "Новости"];

const ARTICLES = [
  {
    featured: true,
    category: "Подборка",
    image:
      "https://images.unsplash.com/photo-1542315264-884813583226?q=80&w=1200&auto=format&fit=crop",
    imageAlt: "Детский футбол",
    dateISO: "2025-10-25",
    dateLabel: "25 окт. 2025",
    readTime: "8 мин. читать",
    title: "Топ-10 футбольных секций Ростова-на-Дону: Рейтинг 2025 года",
    excerpt:
      "Мы проанализировали отзывы родителей, квалификацию тренеров и состояние полей, чтобы составить честный рейтинг футбольных школ для детей от 4 до 14 лет.",
    authorName: "Анна Иванова",
    authorImg: "https://i.pravatar.cc/100?img=33",
    href: "#",
  },
  {
    featured: false,
    category: "Советы",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Ребенок рисует",
    dateISO: "2025-10-20",
    dateLabel: "20 окт. 2025",
    readTime: "5 мин.",
    title: "Как понять, что ребенку не подходит кружок?",
    excerpt:
      "5 неочевидных признаков того, что стоит сменить секцию, даже если тренер кажется профессионалом.",
    authorName: "Олег Петров",
    authorImg: "https://i.pravatar.cc/100?img=12",
    href: "#",
  },
  {
    featured: false,
    category: "Творчество",
    image:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop",
    imageAlt: "ИЗО студия",
    dateISO: "2025-10-15",
    dateLabel: "15 окт. 2025",
    readTime: "6 мин.",
    title: "ИЗО или лепка? Развиваем мелкую моторику правильно",
    excerpt:
      "Обзор творческих направлений для дошкольников. Что лучше выбрать для подготовки руки к письму.",
    authorName: "Мария Сидорова",
    authorImg: "https://i.pravatar.cc/100?img=5",
    href: "#",
  },
  {
    featured: false,
    category: "Новости",
    image:
      "https://images.unsplash.com/photo-1577896335477-2858506f48db?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Школа",
    dateISO: "2025-10-10",
    dateLabel: "10 окт. 2025",
    readTime: "3 мин.",
    title: "Открытие новых технопарков в районе Северный",
    excerpt:
      "В следующем месяце планируется открытие двух новых площадок для занятий робототехникой.",
    authorName: "Редакция Мапка",
    authorImg: "https://via.placeholder.com/24",
    href: "#",
  },
  {
    featured: false,
    category: "Спорт",
    image:
      "https://images.unsplash.com/photo-1565108253106-96b67876823c?q=80&w=800&auto=format&fit=crop",
    imageAlt: "Бассейн",
    dateISO: "2025-10-05",
    dateLabel: "05 окт. 2025",
    readTime: "7 мин.",
    title: "Плавание для здоровья спины: мифы и реальность",
    excerpt:
      "Врач-ортопед рассказывает, какие стили плавания действительно полезны при сколиозе.",
    authorName: "Дмитрий К.",
    authorImg: "https://i.pravatar.cc/100?img=68",
    href: "#",
  },
];

function tagToCategory(tag) {
  // В макете кнопка "Подборки", а бейдж на карточке "Подборка"
  if (tag === "Подборки") return "Подборка";
  return tag;
}

export default function BlogPageClient() {
  const [activeTag, setActiveTag] = useState("Все");

  const filtered = useMemo(() => {
    if (activeTag === "Все") return ARTICLES;
    const cat = tagToCategory(activeTag);
    return ARTICLES.filter((a) => a.category === cat);
  }, [activeTag]);

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
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`category-btn ${t === activeTag ? "active" : ""}`}
              onClick={() => setActiveTag(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="articles-grid">
          {filtered.map((a, idx) => (
            <article
              key={`${a.title}-${idx}`}
              className={`article-card ${a.featured ? "featured" : ""}`}
            >
              <div className="card-img-wrapper">
                <span className="card-category">{a.category}</span>
                <img src={a.image} alt={a.imageAlt} loading="lazy" />
              </div>

              <div className="card-content">
                {a.featured ? (
                  <div className="card-meta">
                    <span className="meta-item">
                      <time dateTime={a.dateISO}>{a.dateLabel}</time>
                    </span>
                    <span className="meta-item">•</span>
                    <span className="meta-item">{a.readTime}</span>
                  </div>
                ) : (
                  <div className="card-meta">
                    <time dateTime={a.dateISO}>{a.dateLabel}</time>
                    <span>• {a.readTime}</span>
                  </div>
                )}

                <a href={a.href}>
                  {/* Чтобы не было “H1 + только H3”, делаем заголовки статей H2 */}
                  <h2 className="card-title">{a.title}</h2>
                </a>

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
                    <a href={a.href} className="read-more">
                      Читать далее &rarr;
                    </a>
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
