import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
// Подключаем наши локальные стили
import styles from './page.module.css';
// Иконки
import { ChevronRight, Calendar, Clock, Share2, MapPin, BookOpen } from 'lucide-react';

const SITE_NAME = 'Мапка.рф';

// === ФУНКЦИЯ ПОЛУЧЕНИЯ ДАННЫХ ===
// Теперь она работает для ЛЮБОЙ ссылки, чтобы не было ошибок
async function getPostData(slug) {
  
  // Если это тестовая ссылка "fds" или любая другая - генерируем контент
  // В реальности здесь будет запрос к базе данных
  
  return {
    title: slug === 'top-detskih-kruzhkov-2026' 
      ? 'Топ-5 направлений для детских кружков в январе 2026 года'
      : `Статья про кадастр: ${slug}`, // Заглушка для теста
      
    slug: slug,
    
    excerpt: 'Обзор самых популярных и полезных занятий для детей и советов по недвижимости.',
    
    // HTML контент статьи
    content: `
      <p class="lead">Начало 2026 года — идеальное время для новых начинаний. Мы собрали актуальную информацию, которая поможет вам принять правильное решение.</p>

      <h2>1. Почему это важно сейчас?</h2>
      <p>Мир меняется стремительно. В 2026 году акцент смещается на цифровую грамотность и безопасность сделок с недвижимостью. Неважно, ищете ли вы кружок для ребенка или проверяете участок — подход должен быть системным.</p>
      
      <h2>2. На что обратить внимание</h2>
      <p>Специалисты рекомендуют всегда проверять документы перед сделкой. Используйте проверенные сервисы, такие как Мапка.рф, для получения выписок ЕГРН.</p>
      <ul>
        <li>Проверяйте кадастровый номер.</li>
        <li>Изучайте зоны с особыми условиями (ЗОУИТ).</li>
        <li>Сравнивайте цены с рыночными.</li>
      </ul>

      <h2>3. Прогнозы на будущее</h2>
      <p>Эксперты полагают, что спрос на загородную недвижимость продолжит расти, как и интерес к техническому образованию детей.</p>
    `,
    
    coverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200',
    publishedAt: '2026-01-15T10:00:00Z',
    readTime: '5 мин',
    author: {
      name: 'Анна Смирнова',
      role: 'Эксперт Мапка.рф',
      avatar: 'https://i.pravatar.cc/150?u=anna'
    },
    category: 'Полезное',
    tags: ['Недвижимость', 'Дети', '2026']
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

  // Форматирование даты
  const dateStr = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className={styles.wrapper}>
      <main className={styles.container}>
        
        {/* Хлебные крошки */}
        <nav className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <ChevronRight size={14} />
          <Link href="/blog">Блог</Link>
          <ChevronRight size={14} />
          <span className={styles.activeCrumb}>{post.title}</span>
        </nav>

        <div className={styles.grid}>
          
          {/* Левая колонка: СТАТЬЯ */}
          <article className={styles.article}>
            <header>
              <div className={styles.meta}>
                <span className={styles.badge}>{post.category}</span>
                <span className={styles.readTime}>
                  <Clock size={14} /> {post.readTime} читать
                </span>
              </div>

              <h1 className={styles.h1}>{post.title}</h1>

              <div className={styles.authorRow}>
                <div className={styles.authorProfile}>
                  <div className={styles.avatar}>
                    <Image src={post.author.avatar} alt="Avatar" fill style={{objectFit: 'cover'}} />
                  </div>
                  <div>
                    <div className={styles.authorName}>{post.author.name}</div>
                    <div className={styles.authorRole}>
                      {post.author.role} • <Calendar size={12} /> {dateStr}
                    </div>
                  </div>
                </div>
                {/* Кнопка поделиться */}
                <Share2 size={20} color="#64748b" style={{cursor: 'pointer'}} />
              </div>
            </header>

            <div className={styles.imageWrapper}>
              <Image 
                src={post.coverImage} 
                alt="Cover" 
                fill 
                priority
                style={{objectFit: 'cover'}} 
              />
            </div>

            {/* Вставка HTML контента */}
            <div 
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: post.content }} 
            />
          </article>

          {/* Правая колонка: САЙДБАР */}
          <aside className={styles.sidebar}>
            <div className={styles.sticky}>
              
              {/* Виджет */}
              <div className={styles.searchWidget}>
                <div className={styles.iconBox}>
                  <MapPin size={24} />
                </div>
                <h3 className={styles.widgetTitle}>Проверка участка</h3>
                <p className={styles.widgetText}>
                  Узнайте владельцев, обременения и историю участка по кадастровому номеру.
                </p>
                <form>
                  <input type="text" placeholder="Введите номер..." className={styles.input} />
                  <button type="button" className={styles.btn}>Найти на карте</button>
                </form>
              </div>

              {/* Читать еще */}
              <div className={styles.moreBlock}>
                <h4 style={{marginBottom: '16px', fontWeight: 'bold'}}>Популярное</h4>
                <Link href="/blog/article-1" className={styles.moreItem}>
                  <h5>Как бесплатно узнать собственника квартиры?</h5>
                  <div className={styles.moreDate}>10 янв 2026</div>
                </Link>
                <Link href="/blog/article-2" className={styles.moreItem}>
                  <h5>Оформление земли в собственность: пошаговый гайд</h5>
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