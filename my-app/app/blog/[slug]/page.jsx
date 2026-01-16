import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import { ChevronRight, Calendar, Clock, Share2, HelpCircle, List } from 'lucide-react';

const SITE_NAME = 'Мапка.рф';
const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';

// === ДАННЫЕ (ТОЛЬКО ДЕТСКИЕ КРУЖКИ) ===
async function getPostData(slug) {
  // Для демо: любой slug открывает эту статью
  return {
    title: 'Топ-7 направлений детских кружков в 2026 году: Полный гид для родителей',
    slug: slug, // сохраняем текущий url для каноникал
    excerpt: 'Робототехника, биохакинг или эмоциональный интеллект? Разбираем самые перспективные направления дополнительного образования.',
    publishedAt: '2026-01-20T09:00:00Z',
    readTime: '8 мин',
    author: {
      name: 'Елена Соколова',
      role: 'Педагог-психолог',
      avatar: 'https://i.pravatar.cc/150?u=elena_kids'
    },
    category: 'Дети и Образование',
    
    // Оглавление (Якоря должны совпадать с id в контенте)
    toc: [
      { id: 'tech', title: '1. IT и Робототехника: Новый уровень' },
      { id: 'media', title: '2. Медиа и Блогинг' },
      { id: 'science', title: '3. Биология и Экология' },
      { id: 'soft-skills', title: '4. Soft Skills и Эмоциональный интеллект' },
      { id: 'finance', title: '5. Финансовая грамотность' },
      { id: 'faq', title: 'Частые вопросы' },
    ],

    // FAQ для статьи
    faq: [
      {
        question: 'С какого возраста лучше отдавать ребенка на программирование?',
        answer: 'Базовые навыки логики (через игры вроде Scratch) можно развивать с 5-6 лет. Серьезные языки (Python) обычно доступны с 10-12 лет.'
      },
      {
        question: 'Как понять, что кружок не подходит?',
        answer: 'Если ребенок идет на занятия с неохотой более 3-4 раз подряд, жалуется на скуку или педагога, стоит рассмотреть смену деятельности. Принуждение убивает мотивацию.'
      },
      {
        question: 'Сколько кружков должно быть у школьника?',
        answer: 'Психологи рекомендуют не более 2-3 направлений, чтобы у ребенка оставалось минимум 2 часа в день на свободное время и отдых.'
      }
    ],

    coverImage: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=1200&auto=format&fit=crop'
  };
}

// === SEO METADATA ===
export async function generateMetadata({ params }) {
  const post = await getPostData(params.slug);
  return {
    title: `${post.title} | Блог ${SITE_NAME}`,
    description: post.excerpt,
    alternates: { canonical: `${SITE_URL}/blog/${params.slug}` },
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPostData(params.slug);
  const dateStr = new Date(post.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  // === JSON-LD (Graph: Article + FAQ) ===
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${SITE_URL}/blog/${post.slug}#article`,
        headline: post.title,
        description: post.excerpt,
        image: post.coverImage,
        datePublished: post.publishedAt,
        author: { '@type': 'Person', name: post.author.name },
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
        }
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/blog/${post.slug}#faq`,
        mainEntity: post.faq.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer
          }
        }))
      }
    ]
  };

  return (
    <div className={styles.wrapper}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className={styles.container}>
        {/* Хлебные крошки */}
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span className={styles.activeCrumb}>Детские кружки 2026</span>
        </nav>

        <div className={styles.grid}>
          {/* === ОСНОВНОЙ КОНТЕНТ === */}
          <article className={styles.article}>
            
            <span className={styles.badge}>{post.category}</span>
            <h1 className={styles.h1}>{post.title}</h1>

            <div className={styles.authorRow}>
              <Image 
                src={post.author.avatar} 
                alt={post.author.name} 
                width={48} 
                height={48} 
                className={styles.avatar} 
              />
              <div className={styles.metaText}>
                <strong>{post.author.name}</strong>
                <span>{dateStr} • {post.readTime} чтения</span>
              </div>
            </div>

            <div className={styles.coverWrapper}>
              <Image src={post.coverImage} alt="Дети на занятиях" fill style={{objectFit: 'cover'}} priority />
            </div>

            <div className={styles.content}>
              <p className="lead">Мир меняется быстрее, чем школьная программа. В 2026 году родители все чаще выбирают кружки, которые учат не просто знаниям, а навыкам адаптации.</p>

              {/* Секции с ID для скролла */}
              <h2 id="tech">1. IT и Робототехника: Новый уровень</h2>
              <p>В 2026 году робототехника перестала быть просто «сборкой Lego». Теперь дети с 10 лет учатся обучать нейросети. Это база для будущих инженеров.</p>
              <ul>
                <li><strong>Тренд:</strong> Промпт-инжиниринг для детей.</li>
                <li><strong>Польза:</strong> Развитие алгоритмического мышления.</li>
              </ul>

              <h2 id="media">2. Медиа и Блогинг</h2>
              <p>Умение держать камеру, говорить на публику и монтировать видео — это новая грамотность. Курсы блогинга учат сторителлингу и уверенности в себе.</p>

              <h2 id="science">3. Биология и Экология (BioTech)</h2>
              <p>Сити-фермерство и микробиология в домашних условиях. Дети выращивают микрозелень и изучают строение клетки под цифровыми микроскопами.</p>

              <h2 id="soft-skills">4. Soft Skills и Эмоциональный интеллект</h2>
              <p>Кружки, где нет оценок, но есть обсуждения. Здесь учат договариваться, понимать свои эмоции и работать в команде. Критически важно для поколения Альфа.</p>

              <h2 id="finance">5. Финансовая грамотность</h2>
              <p>Инвестиции в криптовалюты (на демо-счетах) и планирование карманных расходов. Чем раньше ребенок поймет цену деньгам, тем проще ему будет во взрослой жизни.</p>

              {/* FAQ Секция */}
              <div id="faq" className={styles.faqSection}>
                <div className={styles.faqTitle}>
                  <HelpCircle size={24} style={{display:'inline', marginBottom:-4, marginRight:8}} />
                  Частые вопросы родителей
                </div>
                
                {post.faq.map((item, index) => (
                  <details key={index} className={styles.faqItem}>
                    <summary className={styles.faqSummary}>
                      {item.question}
                      <ChevronRight size={16} />
                    </summary>
                    <div className={styles.faqDetails}>
                      {item.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </article>

          {/* === САЙДБАР (Sticky) === */}
          <aside className={styles.sidebar}>
            <div className={styles.stickyBox}>
              
              {/* Оглавление */}
              <div className={styles.toc}>
                <div className={styles.tocTitle}>
                  <List size={16} style={{display:'inline', marginRight: 6}} />
                  Содержание
                </div>
                <ul className={styles.tocList}>
                  {post.toc.map(item => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className={styles.tocLink}>
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Промо блок (вместо проверки участков - подбор кружка) */}
              <div style={{background: '#dbeafe', padding: '24px', borderRadius: '16px'}}>
                <h3 style={{fontWeight:'bold', marginBottom:'8px', color:'#1e3a8a'}}>Подбор кружка</h3>
                <p style={{fontSize:'14px', marginBottom:'16px', color:'#1e40af'}}>
                  Пройдите тест из 5 вопросов и узнайте, какой талант стоит развивать вашему ребенку.
                </p>
                <button style={{width:'100%', padding:'12px', background:'#2563eb', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                  Пройти тест
                </button>
              </div>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}