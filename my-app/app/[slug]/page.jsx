import { notFound } from 'next/navigation';
import Link from 'next/link';
import './club.css';

import { fetchClubData } from '@/lib/club-api';
import ClubGallery from '@/components/ClubGallery';
import ClubMap from '@/components/ClubMap';
import ClubActions from '@/components/ClubActions';

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const club = await fetchClubData(resolvedParams.slug);

  if (!club) return { title: 'Кружок не найден – Мапка' };

  return {
    title: `${club.title} - Мапка`,
    description: (club.description || '').slice(0, 160),
    openGraph: {
      title: club.title,
      description: `Найди кружок для ребёнка: ${club.category}`,
      images: club.photos?.[0] ? [club.photos[0]] : [],
    },
  };
}

export default async function Page({ params }) {
  const resolvedParams = await params;
  const club = await fetchClubData(resolvedParams.slug);

  if (!club) notFound();

  const priceStr = club.price > 0 ? `${club.price.toLocaleString('ru-RU')} ₽` : 'Бесплатно';
  const ageStr = `${club.minAge} - ${club.maxAge} лет`;

  return (
    <div className="club-main-wrapper">
      {/* Header 1:1 как в статике */}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="back-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span>Назад</span>
          </Link>

          {/* Title appears here on scroll */}
          <div className="header-title-scroll" id="headerScrollTitle">
            {club.title}
          </div>

          <button
            className="back-btn"
            id="shareBtn"
            style={{ border: 'none', background: 'none' }}
            aria-label="Поделиться"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="club-container" id="mainContainer">
        <div className="club-main">
          {/* Header Block */}
          <div className="header-block">
            <div className="badges">
              <span className="badge category">{club.category}</span>
              <span className="badge age">{ageStr}</span>
            </div>

            <h1 className="main-title">{club.title}</h1>

            <div className="address-row">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{club.address}</span>
            </div>
          </div>

          {/* Gallery */}
          <ClubGallery photos={club.photos} />

          {/* Price */}
          <div className="section-card price-card">
            <div className="price-info">
              {/* ✅ FIX: h3 -> h2 + стиль как у остальных секций */}
              <h2 className="section-header">Стоимость обучения</h2>

              <div className="price-value">{priceStr}</div>
              {club.priceNotes ? <div className="price-note">{club.priceNotes}</div> : null}
            </div>
          </div>

          {/* About */}
          <div className="section-card">
            <h2 className="section-header">О кружке</h2>
            <div className="section-text">{club.description}</div>

            {club.tags?.length > 0 ? (
              <div className="tags-section">
                {club.tags.map((t, i) => (
                  <span key={i} className="tag-chip">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {club.socialLinks?.vk || club.socialLinks?.telegram ? (
              <div className="social-block">
                <div className="social-title">Следите за нами в соцсетях:</div>
                <div className="social-grid">
                  {club.socialLinks?.vk ? (
                    <a href={club.socialLinks.vk} target="_blank" rel="noopener noreferrer" className="social-btn social-vk">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.07 2H8.93C5.1 2 2 5.1 2 8.93v6.14C2 18.9 5.1 22 8.93 22h6.14c3.83 0 6.93-3.1 6.93-6.93V8.93C22 5.1 18.9 2 15.07 2zM18 13.5h-1.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5H18c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
                      </svg>
                      ВКонтакте
                    </a>
                  ) : null}

                  {club.socialLinks?.telegram ? (
                    <a href={club.socialLinks.telegram} target="_blank" rel="noopener noreferrer" className="social-btn social-tg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42l10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701l-.25 3.635c.34 0 .63-.166.875-.411l2.368-2.288l4.922 3.635c.907.5 1.56.242 1.783-.855l3.226-15.228c.328-1.536-.576-2.193-1.602-1.745z" />
                      </svg>
                      Telegram
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Schedule */}
          <div className="section-card">
            <h2 className="section-header">Расписание занятий</h2>
            <div className="schedule-list">
              {club.schedules?.length > 0 ? (
                club.schedules.map((s, i) => (
                  <div className="schedule-row" key={i}>
                    <div className="schedule-day">{s.day}</div>
                    <div className="schedule-time">{s.time}</div>
                  </div>
                ))
              ) : (
                <div className="section-text" style={{ color: '#999', padding: '12px' }}>
                  Уточняйте у администратора
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <ClubMap address={club.address} title={club.title} />
        </div>

        {/* Sidebar + Mobile bottom bar */}
        <ClubActions phone={club.phone} />
      </div>
    </div>
  );
}
