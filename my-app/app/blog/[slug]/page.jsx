import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import { ChevronRight, List, ChevronDown, Calendar, User } from 'lucide-react';

const SITE_NAME = 'Мапка.рф';

// === ДАННЫЕ ===
async function getPostData(slug) {
  return {
    title: 'Топ-5 направлений для детских кружков в январе 2026 года: Что выбрать?',
    slug: slug,
    excerpt: 'Робототехника, программирование или спорт? Разбираем тренды дополнительного образования.',
    publishedAt: '2026-01-15T10:00:00Z',
    readTime: '5 мин',
    author: {
      name: 'Анна Смирнова',
      role: 'Детский психолог',
      avatar: 'https://i.pravatar.cc/150?u=anna'
    },
    category: 'Образование и Развитие',
    coverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200',
    
    // Оглавление
    toc: [
      { id: 'robotics', title: '1. Робототехника и ИИ' },
      { id: 'creative', title: '2. Цифровое творчество' },
      { id: 'sport', title: '3. Современный спорт' },
      { id: 'science', title: '4. Научные лаборатории' },
      { id: 'faq', title: 'Частые вопросы' },
    ],

    faq: [
      {
        q: 'С какого возраста можно на программирование?',
        a: 'Для Scratch оптимально 6-7 лет, Python — с 11-12 лет.'
      },
      {
        q: 'Нужен ли свой ноутбук?',
        a: 'Большинство центров предоставляют оборудование, но для домашних заданий компьютер потребуется.'
      }
    ]
  };
}

export async function generateMetadata({ params }) {
  const post = await getPostData(params.slug);
  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPostData(params.slug);
  const dateStr = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: [post.coverImage],
    author: { '@type': 'Person', name: post.author.name }
  };

  return (
    <div className={styles.wrapper}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className={styles.container}>
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span style={{ color: '#0f172a', fontWeight: 500 }}>{post.title}</span>
        </nav>

        <div className={styles.grid}>
          {/* === ЛЕВАЯ КОЛОНКА === */}
          <article className={styles.article}>
            
            <span className={styles.badge}>{post.category}</span>
            <h1 className={styles.h1}>{post.title}</h1>

            <div className={styles.authorRow}>
              <Image src={post.author.avatar} alt={post.author.name} width={48} height={48} className={styles.avatar} />
              <div className={styles.metaText}>
                <strong>{post.author.name}</strong>
                <span>{post.author.role} • {dateStr}</span>
              </div>
            </div>

            <div className={styles.coverWrapper}>
              <Image src={post.coverImage} alt="Cover" fill style={{objectFit: 'cover'}} priority />
            </div>

            {/* Мобильное оглавление: div -> h2 */}
            <div className={styles.mobileToc}>
              <h2 className={styles.tocTitle}>
                <List size={18} /> Содержание
              </h2>
              <ul className={styles.tocList}>
                {post.toc.map(item => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={styles.tocLink}>{item.title}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Контент */}
            <div className={styles.content}>
              <p className="lead">Начало года — идеальное время, чтобы помочь ребенку найти новое увлечение.</p>

              <h2 id="robotics">1. Робототехника и Искусственный Интеллект</h2>
              <p>Кружки по робототехнике учат детей не просто собирать конструкторы, а программировать их.</p>
              <ul>
                <li>Развивает логику.</li>
                <li>Учит работать в команде.</li>
              </ul>

              <h2 id="creative">2. Цифровое творчество</h2>
              <p>От 3D-моделирования до цифровой живописи. Планшет вместо холста.</p>

              <h2 id="sport">3. Современный спорт: Киберспорт и Скалолазание</h2>
              <p>Традиционные секции всегда актуальны, но в тренде виды спорта, развивающие стратегическое мышление.</p>

              <h2 id="science">4. Научные лаборатории</h2>
              <p>Для юных «почемучек» нет ничего лучше, чем самому провести химический опыт.</p>

              {/* FAQ: h3 -> h2 */}
              <div id="faq" className={styles.faqSection}>
                <h2 className={styles.faqTitle}>Частые вопросы</h2>
                {post.faq.map((item, index) => (
                  <details key={index} className={styles.faqItem}>
                    <summary className={styles.faqSummary}>
                      {item.q} <ChevronDown size={16} />
                    </summary>
                    <div className={styles.faqDetails}>{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </article>

          {/* === ПРАВАЯ КОЛОНКА (Сайдбар) === */}
          <aside>
            <div className={styles.desktopToc}>
              {/* Оглавление: div -> h2 */}
              <h2 className={styles.tocTitle}>
                <List size={18} /> Содержание
              </h2>
              <ul className={styles.tocList}>
                {post.toc.map(item => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className={styles.tocLink}>{item.title}</a>
                  </li>
                ))}
              </ul>

              <div className={styles.promoBox}>
                {/* Промо: h4 -> h2 */}
                <h2 className={styles.promoTitle}>Подбор кружка</h2>
                <p style={{fontSize: '13px', color: '#4b5563'}}>Пройдите тест и узнайте талант ребенка.</p>
                <button className={styles.promoBtn}>Начать тест</button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}