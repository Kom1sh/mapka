import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
// Убедитесь, что файл называется page.module.css
import styles from './page.module.css';
import { ChevronRight, Calendar, Clock, HelpCircle, List, ArrowDownCircle } from 'lucide-react';

const SITE_NAME = 'Мапка.рф';
const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';

async function getPostData(slug) {
  return {
    title: 'Детские кружки 2026: Топ-7 направлений для развития ребенка',
    slug: slug,
    excerpt: 'Робототехника с ИИ, биохакинг или блогинг? Полный гид для родителей по выбору секций в новом году.',
    publishedAt: '2026-01-20T09:00:00Z',
    readTime: '6 мин',
    author: {
      name: 'Елена Соколова',
      role: 'Педагог-психолог',
      avatar: 'https://i.pravatar.cc/150?u=elena_kids'
    },
    category: 'Образование',
    
    // Оглавление
    toc: [
      { id: 'tech', title: '1. Робототехника и ИИ' },
      { id: 'media', title: '2. Блогинг и Медиа' },
      { id: 'bio', title: '3. Биология (BioTech)' },
      { id: 'soft', title: '4. Soft Skills' },
      { id: 'faq', title: 'Вопросы и ответы' },
    ],

    faq: [
      {
        question: 'С какого возраста изучать программирование?',
        answer: 'Игровое программирование (Scratch) подходит с 5-6 лет. Python и серьезные задачи — с 10-12 лет.'
      },
      {
        question: 'Сколько кружков нужно ребенку?',
        answer: 'Психологи советуют не более 2-3 секций, чтобы у ребенка оставалось время на отдых и детство.'
      }
    ],

    coverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200'
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
  const dateStr = new Date(post.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Схема JSON-LD (SEO)
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
        
        {/* Навигация (Хлебные крошки) */}
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span className={styles.activeCrumb}>Тренды 2026</span>
        </nav>

        <div className={styles.grid}>
          {/* ЛЕВАЯ КОЛОНКА */}
          <article className={styles.article}>
            
            <span className={styles.badge}>{post.category}</span>
            <h1 className={styles.h1}>{post.title}</h1>

            <div className={styles.authorRow}>
              <Image 
                src={post.author.avatar} 
                alt={post.author.name} 
                width={40} 
                height={40} 
                className={styles.avatar} 
              />
              <div className={styles.metaText}>
                <strong>{post.author.name}</strong>
                <span>{dateStr} • {post.readTime} чтения</span>
              </div>
            </div>

            <div className={styles.coverWrapper}>
              <Image 
                src={post.coverImage} 
                alt="Дети" 
                fill 
                style={{objectFit: 'cover'}} 
                priority 
              />
            </div>

            {/* Мобильное оглавление (Видно только на телефоне) */}
            <div className={styles.mobileToc}>
              <div className={styles.mobileTocTitle}>
                <List size={18} /> Содержание статьи:
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

            <div className={styles.content}>
              <p className="lead">Мир меняется. В 2026 году самыми востребованными навыками становятся не просто знания, а умение адаптироваться.</p>

              <h2 id="tech">1. Робототехника и ИИ</h2>
              <p>Робототехника перешла на новый уровень. Теперь дети учат роботов распознавать образы с помощью нейросетей.</p>
              <ul>
                <li>Развитие логики и математики.</li>
                <li>Понимание принципов работы ИИ.</li>
              </ul>

              <h2 id="media">2. Блогинг и Медиа</h2>
              <p>Умение презентовать себя — ключевой навык будущего. Курсы блогинга учат не кривляться на камеру, а структурировать мысли и держать внимание аудитории.</p>

              <h2 id="bio">3. Биология (BioTech)</h2>
              <p>Сити-фермерство и микробиология. Дети выращивают растения в умных теплицах и изучают мир под цифровым микроскопом.</p>

              <h2 id="soft">4. Soft Skills</h2>
              <p>Эмоциональный интеллект важнее оценок. Умение договариваться и работать в команде — залог успеха в любой профессии.</p>

              {/* FAQ Блок */}
              <div id="faq" className={styles.faqSection}>
                <h3 style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '16px'}}>Частые вопросы</h3>
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

          {/* ПРАВАЯ КОЛОНКА (САЙДБАР) */}
          <aside className={styles.sidebar}>
            
            {/* Десктопное оглавление (Липкое) */}
            <div className={styles.desktopToc}>
              <div style={{fontWeight:'bold', marginBottom:'16px', display:'flex', gap:'8px'}}>
                <List size={18} /> Содержание
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

            {/* Промо блок */}
            <div className={styles.promoBox}>
              <h3 style={{fontSize:'16px', fontWeight:'bold', marginBottom:'8px', color:'#1e3a8a'}}>
                Подбор кружка
              </h3>
              <p style={{fontSize:'13px', marginBottom:'12px', color:'#1e40af'}}>
                Пройдите тест и узнайте талант ребенка.
              </p>
              <button className={styles.promoBtn}>Начать тест</button>
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
}