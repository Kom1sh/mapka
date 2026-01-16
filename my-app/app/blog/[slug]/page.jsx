import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Calendar, Clock, Share2, MapPin, User, BookOpen } from 'lucide-react';

// === КОНФИГУРАЦИЯ ПРОЕКТА ===
const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';
const SITE_NAME = 'Мапка.рф';

// === 1. ДЕМО ДАННЫЕ (Детские кружки, Январь 2026) ===
async function getPostData(slug) {
  // В реальности здесь будет запрос к базе данных или API
  if (slug === 'top-detskih-kruzhkov-2026') {
    return {
      id: 1,
      title: 'Топ-5 направлений для детских кружков в январе 2026 года: Что выбрать?',
      slug: 'top-detskih-kruzhkov-2026',
      excerpt: 'Обзор самых популярных и полезных занятий для детей: от программирования и робототехники до творческих студий и спорта. Как помочь ребенку найти свое призвание в новом году.',
      content: `
        <p class="lead text-xl text-slate-600 mb-6">Начало года — идеальное время, чтобы помочь ребенку найти новое увлечение. В 2026 году акцент смещается на развитие цифровых навыков и креативности, но не стоит забывать и о физической активности.</p>

        <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">1. Робототехника и Искусственный Интеллект</h2>
        <p class="mb-4 text-slate-700">Это уже не будущее, а настоящее. Кружки по робототехнике учат детей не просто собирать конструкторы, а программировать их, понимать основы логики и инженерии. В 2026 году популярны курсы, где дети создают свои простейшие модели ИИ.</p>
        <ul class="list-disc pl-5 mb-6 text-slate-700 space-y-2">
          <li>Развивает логическое мышление.</li>
          <li>Дает навыки программирования (Python, Scratch).</li>
          <li>Учит работать в команде над проектами.</li>
        </ul>

        <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">2. Цифровое творчество и Дизайн</h2>
        <p class="mb-4 text-slate-700">От 3D-моделирования до создания цифровой живописи. Если ваш ребенок любит рисовать, современные студии предложат ему планшет и стилус вместо кисти. Это отличный старт для будущих дизайнеров, аниматоров и архитекторов.</p>

        <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">3. Современный спорт: Скалолазание и Киберспорт</h2>
        <p class="mb-4 text-slate-700">Традиционные секции (плавание, футбол) всегда актуальны, но в тренде — скалолазание, развивающее координацию и силу, и... киберспорт. Да, это тоже спорт, который требует дисциплины, стратегического мышления и командной работы. Главное — под руководством опытного тренера.</p>

        <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">4. Научные лаборатории и Эксперименты</h2>
        <p class="mb-4 text-slate-700">Для юных "почемучек" нет ничего лучше, чем самому провести химический опыт или собрать физическую модель. Практические занятия пробуждают интерес к науке гораздо эффективнее, чем сухие параграфы учебника.</p>
        
        <h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4">Как выбрать?</h2>
        <p class="mb-4 text-slate-700">Самый простой совет — прислушайтесь к ребенку. Сходите на пробные занятия. Не бойтесь менять направления, ведь главная цель — чтобы ребенок получал удовольствие от процесса познания.</p>
      `,
      coverImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop', // Изображение детей
      publishedAt: '2026-01-15T10:00:00Z',
      readTime: '5 мин',
      author: {
        name: 'Анна Смирнова',
        avatar: 'https://i.pravatar.cc/150?u=anna',
        role: 'Детский психолог, педагог'
      },
      category: 'Образование и Развитие',
      tags: ['Дети', 'Кружки', 'Образование 2026', 'Робототехника']
    };
  }
  return null;
}

// === 2. SEO METADATA ===
export async function generateMetadata({ params }) {
  const post = await getPostData(params.slug);
  if (!post) return { title: 'Статья не найдена' };

  return {
    title: `${post.title} | Блог ${SITE_NAME}`,
    description: post.excerpt,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: SITE_NAME,
      locale: 'ru_RU',
      type: 'article',
      images: [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }],
    },
  };
}

// === 3. КОМПОНЕНТ СТРАНИЦЫ ===
export default async function BlogPostPage({ params }) {
  const post = await getPostData(params.slug);
  if (!post) notFound();

  const formattedDate = new Date(post.publishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: [post.coverImage],
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    description: post.excerpt,
    author: { '@type': 'Person', name: post.author.name },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-10 max-w-7xl">
        <nav className="flex items-center text-sm text-slate-500 mb-8 overflow-x-auto">
          <Link href="/" className="hover:text-blue-600 whitespace-nowrap">Главная</Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <Link href="/blog" className="hover:text-blue-600 whitespace-nowrap">Блог</Link>
          <ChevronRight className="w-4 h-4 mx-2 flex-shrink-0" />
          <span className="text-slate-800 font-medium truncate">{post.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <article className="lg:col-span-8 bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100">
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
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                    <Image src={post.author.avatar} alt={post.author.name} fill className="object-cover" />
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
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-10 bg-slate-100">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
              />
            </div>

            <div 
              className="prose prose-lg prose-slate max-w-none prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-img:rounded-xl prose-headings:text-slate-900 prose-headings:font-bold"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            <div className="mt-12 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Темы:</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <Link 
                    key={tag} 
                    href={`/blog/tags/${tag.toLowerCase()}`}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          </article>

          <aside className="lg:col-span-4 space-y-6">
            <div className="sticky top-10 space-y-6">
              
              {/* Виджет "Поиск кружков" */}
              <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4 text-white">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Ищете кружок рядом с домом?</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Найдите лучшие секции и студии в вашем районе на нашей карте.
                  </p>
                  <form action={SITE_URL} className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="Введите ваш адрес или район..." 
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
                  <Link href="#" className="group block">
                    <h5 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                      Как бесплатно записать ребенка в спортивную школу в 2026 году?
                    </h5>
                    <span className="text-xs text-slate-400 mt-1 block">10 янв 2026</span>
                  </Link>
                  <Link href="#" className="group block">
                    <h5 className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                      Обзор лучших онлайн-курсов по программированию для школьников.
                    </h5>
                    <span className="text-xs text-slate-400 mt-1 block">05 янв 2026</span>
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}