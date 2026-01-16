import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
// Импортируем локальные стили
import styles from './blog-page.css'; 
// Иконки
import { ChevronRight, Calendar, Clock, Share2, BookOpen } from 'lucide-react';

const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';
const SITE_NAME = 'Мапка.рф';

// === ПОЛУЧЕНИЕ ДАННЫХ ===
async function getPostData(slug) {
  // Игнорируем проверку слага для теста, чтобы всегда открывалась статья
  return {
    id: 1,
    title: 'Топ-5 направлений для детских кружков в январе 2026 года',
    slug: slug, // Используем текущий слаг
    excerpt: 'Обзор самых популярных и полезных занятий для детей: робототехника, дизайн, спорт и наука.',
    content: `
      <p>Начало года — идеальное время, чтобы помочь ребенку найти новое увлечение. В 2026 году акцент смещается на развитие цифровых навыков и креативности.</p>

      <h2>1. Робототехника и ИИ</h2>
      <p>Кружки по робототехнике учат детей программировать и понимать основы инженерии. В 2026 году популярны курсы, где дети создают свои модели ИИ.</p>
      <ul>
        <li>Развивает логическое мышление.</li>
        <li>Дает навыки программирования (Python, Scratch).</li>
      </ul>

      <h2>2. Цифровое творчество</h2>
      <p>Если ваш ребенок любит рисовать, современные студии предложат ему планшет и стилус. Это старт для будущих дизайнеров.</p>

      <h2>3. Современный спорт</h2>
      <p>В тренде — скалолазание и киберспорт. Да, это тоже спорт, требующий дисциплины и командной работы.</p>
      
      <h2>Как выбрать?</h2>
      <p>Сходите на пробные занятия. Главная цель — чтобы ребенок получал удовольствие.</p>
    `,
    coverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop',
    publishedAt: '2026-01-15T10:00:00Z',
    readTime: '5 мин',
    author: {
      name: 'Анна Смирнова',
      avatar: 'https://i.pravatar.cc/150?u=anna',
      role: 'Детский психолог'
    },
    category: 'Образование',
    tags: ['Дети', 'Кружки 2026', 'Развитие']
  };
}

export async function generateMetadata({ params }) {
  const post = await getPostData(params.slug);
  if (!post) return { title: 'Статья не найдена' };
  return {
    title: `${post.title} | ${SITE_NAME}`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }) {
  const post = await getPostData(params.slug);

  if (!post) {
    notFound();
  }

  const formattedDate = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className={styles.wrapper}>
      <main className={styles.container}>
        
        {/* Навигация */}
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span className={styles.crumbActive}>{post.title}</span>
        </nav>

        <div className={styles.grid}>
          {/* Левая колонка - СТАТЬЯ */}
          <article className={styles.articleCard}>
            <header>
              <div className={styles.metaHeader}>
                <span className={styles.category}>{post.category}</span>
                <span className={styles.readTime}>
                  <Clock size={14} /> {post.readTime} читать
                </span>
              </div>

              <h1 className={styles.title}>{post.title}</h1>

              <div className={styles.authorBlock}>
                <div className={styles.authorInfo}>
                  <div className={styles.avatar}>
                    <Image src={post.author.avatar} alt={post.author.name} fill style={{objectFit: 'cover'}} />
                  </div>
                  <div>
                    <div className={styles.authorName}>{post.author.name}</div>
                    <div className={styles.date}>
                      {post.author.role} • <Calendar size={12} /> {formattedDate}
                    </div>
                  </div>
                </div>
                <Share2 size={20} color="#64748b" style={{cursor: 'pointer'}} />
              </div>
            </header>

            {/* Картинка */}
            <div className={styles.coverImageWrapper}>
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority
                style={{objectFit: 'cover'}}
              />
            </div>

            {/* Текст статьи */}
            <div 
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Теги */}
            <div className={styles.tags}>
              <div className={styles.tagsTitle}>Темы:</div>
              <div className={styles.tagList}>
                {post.tags.map(tag => (
                  <Link key={tag} href="#" className={styles.tag}>
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          </article>

          {/* Правая колонка - САЙДБАР */}
          <aside className={styles.sidebar}>
            <div className={styles.stickyWrapper}>
              
              {/* Виджет */}
              <div className={styles.searchWidget}>
                <div className={styles.widgetIcon}>
                  <BookOpen size={24} />
                </div>
                <h3 className={styles.widgetTitle}>Кружки рядом</h3>
                <p className={styles.widgetText}>
                  Найдите секции в вашем районе на карте.
                </p>
                <form>
                  <input 
                    type="text" 
                    placeholder="Ваш адрес..." 
                    className={styles.input}
                  />
                  <button type="button" className={styles.button}>
                    Найти на карте
                  </button>
                </form>
              </div>

              {/* Читать еще */}
              <div className={styles.moreBlock}>
                <div className={styles.moreTitle}>Популярное</div>
                <Link href="#" className={styles.moreLink}>
                  <h5>Спортшколы: как попасть бесплатно?</h5>
                  <div className={styles.moreDate}>10 янв 2026</div>
                </Link>
                <Link href="#" className={styles.moreLink}>
                  <h5>Онлайн курсы программирования</h5>
                  <div className={styles.moreDate}>05 янв 2026</div>
                </Link>
              </div>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}