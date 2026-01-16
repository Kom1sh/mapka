import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
// Иконки (легковесные, отлично для SEO)
import { ChevronRight, Calendar, Clock, Share2, MapPin, User } from 'lucide-react';

// === КОНФИГУРАЦИЯ ПРОЕКТА ===
const SITE_URL = 'https://xn--80aa3agq.xn--p1ai'; // Punycode для мапка.рф
const SITE_NAME = 'Мапка.рф';

// === 1. ДЕМО ДАННЫЕ (Имитация API) ===
// В будущем вы просто замените вызов этой функции на fetch запрос к вашему бэкенду
async function getPostData(slug) {
  // Имитация задержки сети
  // await new Promise(resolve => setTimeout(resolve, 100));

  // Если статья не найдена (для теста можно поменять slug)
  if (slug === 'error') return null;

  // Возвращаем объект статьи
  return {
    id: 1,
    title: 'Как проверить земельный участок перед покупкой: Полный гайд 2024',
    slug: 'kak-proverit-uchastok',
    excerpt: 'Пошаговая инструкция по проверке юридической чистоты участка с помощью публичной кадастровой карты.',
    // HTML контент, который обычно приходит из админки (Wordpress, Strapi и т.д.)
    content: `
      <p class="lead text-xl text-slate-600 mb-6">Покупка земли — это всегда риск. Без должной проверки можно приобрести участок с обременениями или неверными границами.</p>
      <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Проверка кадастрового номера</h2>
      <p class="mb-4 text-slate-700">Первым делом запросите у продавца кадастровый номер. Введите его на главной странице <a href="${SITE_URL}" class="text-blue-600 hover:underline">Мапка.рф</a>.</p>
      <p class="mb-4 text-slate-700">Вам станут доступны:</p>
      <ul class="list-disc pl-5 mb-6 text-slate-700 space-y-2">
        <li>Категория земель.</li>
        <li>Точная площадь и кадастровая стоимость.</li>
        <li>Форма собственности.</li>
      </ul>
      <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Зоны с особыми условиями</h2>
      <p class="mb-4 text-slate-700">Не забывайте проверять ЗОУИТ. Это могут быть охранные зоны ЛЭП или газопроводов.</p>
    `,
    coverImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop', // Заглушка
    publishedAt: '2023-10-25T10:00:00Z',
    readTime: '7 мин',
    author: {
      name: 'Дмитрий Петров',
      avatar: 'https://i.pravatar.cc/150?u=dmitry',
      role: 'Кадастровый инженер'
    },
    category: 'Полезные советы',
    tags: ['Недвижимость', 'Росреестр', 'Инструкция']
  };
}

// === 2. SEO METADATA (Генерация мета-тегов) ===
export async function generateMetadata({ params }) {
  const post = await getPostData(params.slug);

  if (!post) {
    return { title: 'Статья не найдена' };
  }

  return {
    title: `${post.title} | Блог ${SITE_NAME}`,
    description: post.excerpt,
    alternates: {
      canonical: `${SITE_URL}/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      type: 'article',
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

// === 3. КОМПОНЕНТ СТРАНИЦЫ ===
export default async function BlogPostPage({ params }) {
  // Получаем данные
  const post = await getPostData(params.slug);

  // Обработка 404
  if (!post) {
    notFound();
  }

  // Форматирование даты
  const formattedDate = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // JSON-LD Разметка (Schema.org) для Google/Yandex
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: [post.coverImage],
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: `${SITE_URL}/authors/dmitry` // Пример ссылки
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      
      {/* Вставка микроразметки */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Основной контейнер */}
      <main className="container mx-auto px-4 py-10 max-w-7xl">
        
        {/* Хлебные крошки (Nav Chain) */}
        <nav className="flex items-center text-sm text-slate-500 mb-8 overflow-x-auto">
          <Link href="/" className="hover:text-blue-600 whitespace-nowrap">Главная</Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <Link href="/blog" className="hover:text-blue-600 whitespace-nowrap">Блог</Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <span className="text-slate-800 font-medium truncate">{post.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* ЛЕВАЯ КОЛОНКА: Статья (8 из 12 колонок) */}
          <article className="lg:col-span-8 bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100">
            
            {/* Хедер статьи */}
            <header className="mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  {post.category}
                </span>
                <span className="flex items-center text-slate-400 text-xs">
                  <Clock className="w-3 h-3 mr-1" /> {post.readTime} читать
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-900 mb-6">
                {post.title}
              </h1>

              {/* Информация об авторе */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                    <Image 
                      src={post.author.avatar} 
                      alt={post.author.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{post.author.name}</div>
                    <div className="flex items-center text-xs text-slate-500">
                      <span className="mr-2">{post.author.role}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full mx-1"></span>
                      <Calendar className="w-3 h-3 mr-1 ml-1" />
                      <time dateTime={post.publishedAt}>{formattedDate}</time>
                    </div>
                  </div>
                </div>
                
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" aria-label="Поделиться">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Главное изображение (LCP Optimized) */}
            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-10 bg-slate-100">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority={true} // Приоритетная загрузка для SEO
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
              />
            </div>

            {/* Тело статьи (Rich Text) */}
            {/* Класс prose автоматически стилизует HTML заголовки, списки и параграфы */}
            <div 
              className="prose prose-lg prose-slate max-w-none prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Футер статьи с тегами */}
            <div className="mt-12 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Темы:</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <Link 
                    key={tag} 
                    href={`/blog/tags/${tag}`}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          </article>

          {/* ПРАВАЯ КОЛОНКА: Сайдбар (4 из 12 колонок) */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Sticky блок (прилипает при скролле) */}
            <div className="sticky top-10 space-y-6">
              
              {/* Виджет "Проверь участок" (CTA) */}
              <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 relative overflow-hidden">
                {/* Декоративный фон */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4 text-white">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Знаете кадастровый номер?</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Получите полный отчет об участке: владельцы, обременения и история.
                  </p>
                  
                  <form action={SITE_URL} className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="77:01:0002001:1234" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                    <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors shadow-lg shadow-blue-600/20">
                      Найти на карте
                    </button>
                  </form>
                </div>
              </div>

              {/* Блок "Читать также" */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-4">Популярное в блоге</h4>
                <div className="space-y-4">
                  {[1, 2, 3].map((item) => (
                    <Link key={item} href="#" className="group block">
                      <h5 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                        Как бесплатно узнать собственника квартиры в 2024 году?
                      </h5>
                      <span className="text-xs text-slate-400 mt-1 block">15 окт 2023</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}