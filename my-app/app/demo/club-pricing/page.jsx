"use client";

import Link from "next/link";
import PricingBlockClient from "./PricingBlockClient";

const demoClub = {
  name: "SQ Kids",
  slug: "sqkids",
  category: "Спорт",
  ageText: "7–12 лет",
  address: "ул. Волкова, 9Б, микрорайон Северный",
  photos: [
    "https://cdn-blog.gdemoideti.ru/2021/10/robototekhnika-kruzhok-deti-3.jpg",
  ],
  descriptionHtml: `
    <p>Спортивный клуб <strong>SQ Kids</strong> — это место, где дети могут заниматься спортивной гимнастикой под руководством опытных тренеров.</p>
    <p>Есть <em>пробные</em> занятия, групповые и индивидуальные форматы.</p>
  `,
  tags: ["Спортивная гимнастика", "Робототехника"],
  schedules: [
    { day: "Понедельник", time: "09:00-21:00" },
    { day: "Вторник", time: "09:00-21:00" },
    { day: "Среда", time: "09:00-21:00" },
    { day: "Четверг", time: "09:00-21:00" },
    { day: "Пятница", time: "09:00-21:00" },
    { day: "Суббота", time: "09:00-21:00" },
  ],
  cta: {
    phone: "+7 (988) 551-97-77",
    whatsapp:
      "https://wa.me/79885519777?text=%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%BD%D0%B0%20%D0%B7%D0%B0%D0%BD%D1%8F%D1%82%D0%B8%D0%B5%20%D1%81%20%D0%9C%D0%B0%D0%BF%D0%BA%D0%B0.%D1%80%D1%84",
  },
};

const demoPrices = [
  {
    id: "trial",
    group: "Разовое",
    title: "Пробное занятие",
    subtitle: "Для новых учеников. Включён инвентарь.",
    price_rub: 0,
    badge: "Новичкам",
    icon: "🧸",
    details: ["Длительность: 60 минут", "Форма: удобная спортивная одежда"],
  },
  {
    id: "single",
    group: "Разовое",
    title: "Разовое посещение",
    subtitle: "Групповая тренировка 60 минут.",
    price_rub: 1500,
    icon: "🏃‍♂️",
    details: ["Можно оплатить на месте", "Подходит для разовых визитов"],
  },
  {
    id: "start",
    group: "Абонементы",
    title: 'Абонемент "Старт" (4 занятия)',
    subtitle: "1 раз в неделю. Действует 30 дней.",
    price_rub: 5500,
    per: "за абонемент",
    icon: "🎟️",
    details: ["Цена за занятие ≈ 1375 ₽", "Перенос 1 занятия"],
  },
  {
    id: "progress",
    group: "Абонементы",
    title: 'Абонемент "Прогресс" (8 занятий)',
    subtitle: "2 раза в неделю. Выгоднее.",
    price_rub: 10000,
    per: "за абонемент",
    badge: "Выгодно",
    icon: "📈",
    details: ["Цена за занятие ≈ 1250 ₽", "Перенос 2 занятий"],
  },
  {
    id: "champ",
    group: "Абонементы",
    title: 'Абонемент "Чемпион" (12 занятий)',
    subtitle: "3 раза в неделю. Максимальный эффект.",
    price_rub: 14000,
    per: "за абонемент",
    badge: "ТОП",
    icon: "🏆",
    details: ["Цена за занятие ≈ 1167 ₽", "Перенос 3 занятий"],
  },
  {
    id: "ind",
    group: "Индивидуально",
    title: "Индивидуальная тренировка",
    subtitle: "Персональное занятие с тренером.",
    price_rub: 2500,
    per: "за занятие",
    icon: "🎯",
    details: ["Длительность: 60 минут", "Фокус на цели ребёнка"],
  },
  {
    id: "tournament",
    group: "Дополнительно",
    title: "Участие в турнире",
    subtitle: "Стартовый взнос на внутренний турнир.",
    price_rub: 1200,
    icon: "🥇",
    details: ["Даты публикуются заранее", "Разовый взнос"],
  },
];

export default function DemoClubPricingPage() {
  const title = demoClub.name;

  return (
    <div className="club-main-wrapper">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="back-btn">
            <span>← Назад</span>
          </Link>

          <div className="header-title-scroll visible">{title}</div>

          <button
            className="back-btn"
            style={{ border: "none", background: "none" }}
            aria-label="Поделиться"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert("Ссылка скопирована");
            }}
          >
            Поделиться
          </button>
        </div>
      </header>

      <div className="club-container">
        <div className="club-main">
          <div className="header-block">
            <div className="badges">
              {demoClub.category ? (
                <span className="badge category">{demoClub.category}</span>
              ) : null}
              {demoClub.ageText ? (
                <span className="badge age">{demoClub.ageText}</span>
              ) : null}
            </div>

            <h1 className="main-title">{demoClub.name}</h1>

            <div className="address-row">
              <span>{demoClub.address}</span>
            </div>
          </div>

          <div className="gallery-container">
            <div className="gallery-track" style={{ transform: "translateX(0)" }}>
              <div className="gallery-slide">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={demoClub.photos[0]}
                  alt={demoClub.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          </div>

          <div className="section-card">
            <PricingBlockClient items={demoPrices} ctaHref={demoClub.cta.whatsapp} />
          </div>

          <div className="section-card">
            <h2 className="section-header">О кружке</h2>
            <div
              className="section-text"
              dangerouslySetInnerHTML={{ __html: demoClub.descriptionHtml }}
            />
          </div>
        </div>

        <aside className="sidebar-wrapper">
          <div className="sidebar-sticky">
            <a className="cta-btn btn-primary" href={demoClub.cta.whatsapp} target="_blank" rel="noreferrer">
              Записаться
            </a>
            <a className="cta-btn btn-outline" href="/">
              Открыть карту
            </a>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Телефон: {demoClub.cta.phone}
            </div>
          </div>
        </aside>
      </div>

      <div className="mobile-bottom-bar">
        <a className="cta-btn btn-primary" style={{ padding: 12 }} href={demoClub.cta.whatsapp} target="_blank" rel="noreferrer">
          Записаться
        </a>
        <a className="cta-btn btn-outline" style={{ padding: 12 }} href="/">
          Карта
        </a>
      </div>
    </div>
  );
}
