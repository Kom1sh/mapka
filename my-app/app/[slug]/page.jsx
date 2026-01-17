import { notFound } from 'next/navigation';
import Link from 'next/link';
import './club.css';

import { fetchClubData } from '@/lib/club-api';
import ClubGallery from '@/components/ClubGallery';
import ClubMap from '@/components/ClubMap';
import ClubActions from '@/components/ClubActions';

import PricingBlockClient from './PricingBlockClient';

const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';

function stripHtml(s) {
  return String(s || '')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function ensureHttps(u) {
  const s = String(u || '').trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return `https://${s.replace(/^\/\//, '')}`;
}

/**
 * Делает ссылку максимально “живучей”:
 * - добавляет https://
 * - нормализует через URL (в т.ч. кириллические домены)
 */
function ensureUrl(u) {
  const https = ensureHttps(u);
  if (!https) return null;
  try {
    return new URL(https).toString();
  } catch {
    return https;
  }
}

function normalizePhoneForSchema(phone) {
  const s = String(phone || '').trim();
  if (!s) return null;
  const cleaned = s.replace(/[^\d+]/g, '');
  return cleaned || null;
}

function phoneToTelHref(phone) {
  const p = normalizePhoneForSchema(phone);
  return p ? `tel:${p}` : null;
}

function toAgeNum(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s || s === 'null' || s === 'undefined') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatAge(minAge, maxAge) {
  const min = toAgeNum(minAge);
  const max = toAgeNum(maxAge);

  if (min == null && max == null) return null;
  if (min == null) return `до ${max} лет`;
  if (max == null) return `от ${min} лет`;
  if (min === max) return `${min} лет`;
  return `${min}–${max} лет`;
}

const RU_DAY_TO_SCHEMA = {
  Понедельник: 'Monday',
  Вторник: 'Tuesday',
  Среда: 'Wednesday',
  Четверг: 'Thursday',
  Пятница: 'Friday',
  Суббота: 'Saturday',
  Воскресенье: 'Sunday',
};

function parseTimeRange(timeStr) {
  const t = String(timeStr || '').trim().replace(/–|—/g, '-');
  const m = t.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!m) return null;
  const opens = m[1].padStart(5, '0');
  const closes = m[2].padStart(5, '0');
  return { opens, closes };
}

// --- Pricing normalization ---
const PRICING_GROUP_MAP = {
  one_time: 'Разовое',
  oneTime: 'Разовое',
  'one-time': 'Разовое',
  single: 'Разовое',
  once: 'Разовое',
  subscription: 'Абонементы',
  subscriptions: 'Абонементы',
  abonement: 'Абонементы',
  abonements: 'Абонементы',
  monthly: 'Абонементы',
  individual: 'Индивидуально',
  personal: 'Индивидуально',
  extra: 'Дополнительно',
  add: 'Дополнительно',
};

function normalizePricingGroup(g) {
  const raw = String(g || '').trim();
  if (!raw) return '';

  if (PRICING_GROUP_MAP[raw]) return PRICING_GROUP_MAP[raw];
  const lower = raw.toLowerCase();
  if (PRICING_GROUP_MAP[lower]) return PRICING_GROUP_MAP[lower];

  // Если уже по-русски — оставляем как есть
  return raw;
}

function splitDetails(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);

  const lines = String(v)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.replace(/^[-•\*]+\s+/, '').trim());

  return lines;
}

function normalizePricingItems(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((it, idx) => {
      const o = it && typeof it === 'object' ? it : {};

      const priceText = String(o.price_text ?? o.priceText ?? '').trim();
      const priceRubRaw = o.price_rub ?? o.priceRub ?? o.price ?? o.amount;
      const priceRub = Number.isFinite(Number(priceRubRaw)) ? Number(priceRubRaw) : undefined;

      const details = splitDetails(o.details ?? o.detailsText ?? o.details_text);

      return {
        id: o.id || `pricing-${idx}`,
        group: normalizePricingGroup(o.group ?? o.category ?? o.type),
        title: String(o.title ?? o.name ?? '').trim(),
        subtitle: String(o.subtitle ?? o.description ?? '').trim(),
        badge: String(o.badge ?? '').trim(),
        icon: String(o.icon ?? '').trim(),
        per: String(o.per ?? o.unit ?? '').trim(),
        price_rub: priceRub,
        price_text: priceText,
        details,
      };
    })
    .filter((x) => x.title);
}

function minPositivePrice(items) {
  const nums = (items || [])
    .map((x) => Number(x?.price_rub))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return Math.min(...nums);
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const club = await fetchClubData(resolvedParams.slug);

  if (!club) return { title: 'Кружок не найден – Мапка' };

  const title = club.title || club.name || 'Кружок';
  const description = stripHtml(club.meta_description || club.metaDescription || club.description || '').slice(0, 160);
  const canonical = `${SITE_URL}/${resolvedParams.slug}`;

  const img =
    (Array.isArray(club.photos) && club.photos[0]) ||
    club.image ||
    club.main_image_url ||
    null;

  return {
    title: `${title} - Мапка`,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: img ? [img] : [],
    },
  };
}

export default async function Page({ params }) {
  const resolvedParams = await params;
  const club = await fetchClubData(resolvedParams.slug);

  if (!club) notFound();

  const slug = resolvedParams.slug;
  const url = `${SITE_URL}/${slug}`;

  const title = club.title || club.name || '';
  const addressText = club.address || club.location || '';
  const category = String(club.category || '').trim();
  const ageText = formatAge(club.minAge, club.maxAge);

  // --- Pricing (new block) ---
  const pricingItems = normalizePricingItems(
    club.pricing ?? club.pricing_items ?? club.pricingItems
  );

  // Legacy single price (keep for backward compatibility)
  let priceNum = Number(club.price ?? club.price_rub ?? 0);
  let hasPrice = Number.isFinite(priceNum) && priceNum > 0;

  // Если single price не задан, но есть pricingItems — берём минимальную цену для schema/шапки.
  if (!hasPrice && pricingItems.length) {
    const min = minPositivePrice(pricingItems);
    if (min != null) {
      priceNum = min;
      hasPrice = true;
    }
  }

  const priceStr = hasPrice ? `${priceNum.toLocaleString('ru-RU')} ₽` : 'Бесплатно';

  // --- Schema: Breadcrumbs ---
  const breadcrumbsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: title || slug, item: url },
    ],
  };

  // --- Schema: LocalBusiness ---
  const image =
    (Array.isArray(club.photos) && club.photos[0]) ||
    club.image ||
    club.main_image_url ||
    null;

  const sameAs = [];

  // ✅ FIX: читаем сайт из разных возможных полей (админки/бэка)
  const rawWebsite =
    club.webSite ??
    club.website ??
    club.web_site ??
    club.site ??
    null;

  const websiteHref = ensureUrl(rawWebsite);
  if (websiteHref) sameAs.push(websiteHref);

  const socials = club.socialLinks && typeof club.socialLinks === 'object' ? club.socialLinks : {};
  for (const v of Object.values(socials)) {
    const u = ensureUrl(v);
    if (u) sameAs.push(u);
  }

  const openingHoursSpecification = (club.schedules || [])
    .map((s) => {
      const day = RU_DAY_TO_SCHEMA[String(s.day || '').trim()];
      const tr = parseTimeRange(s.time);
      if (!day || !tr) return null;
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day,
        opens: tr.opens,
        closes: tr.closes,
      };
    })
    .filter(Boolean);

  const offers = hasPrice
    ? [
        {
          '@type': 'Offer',
          price: priceNum,
          priceCurrency: 'RUB',
          url,
          availability: 'https://schema.org/InStock',
          description: club.priceNotes ? String(club.priceNotes) : undefined,
        },
      ]
    : undefined;

  const clubJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}#club`,
    name: title,
    url,
    description: stripHtml(club.description || club.meta_description || club.metaDescription || '') || undefined,
    image: image || undefined,
    telephone: normalizePhoneForSchema(club.phone) || undefined,
    sameAs: sameAs.length ? Array.from(new Set(sameAs)) : undefined,
    category: category || undefined,
    address: addressText
      ? {
          '@type': 'PostalAddress',
          streetAddress: addressText,
          addressLocality: /ростов/i.test(addressText) ? 'Ростов-на-Дону' : undefined,
          addressCountry: 'RU',
        }
      : undefined,
    geo:
      Number.isFinite(club.lat) && Number.isFinite(club.lon)
        ? { '@type': 'GeoCoordinates', latitude: club.lat, longitude: club.lon }
        : undefined,
    openingHoursSpecification: openingHoursSpecification.length ? openingHoursSpecification : undefined,
    offers,
  };

  // --- Schema: WebPage ---
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: `${title} - Мапка`,
    description: stripHtml(club.meta_description || club.metaDescription || club.description || '').slice(0, 160) || undefined,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${url}#club` },
    inLanguage: 'ru-RU',
  };

  // --- Buttons (UI) ---
  const SOCIAL_BUTTONS = [
    { key: 'vk', label: 'ВКонтакте', className: 'social-vk' },
    { key: 'telegram', label: 'Telegram', className: 'social-tg' },
    { key: 'whatsapp', label: 'WhatsApp', className: 'social-wa' },
    { key: 'instagram', label: 'Instagram', className: 'social-ig' },
    { key: 'youtube', label: 'YouTube', className: 'social-yt' },
  ];

  const socialButtons = SOCIAL_BUTTONS.map((b) => {
    const raw = socials?.[b.key];
    const href = ensureUrl(raw);
    if (!href) return null;
    return { ...b, href };
  }).filter(Boolean);

  const linkButtons = [];
  if (websiteHref) {
    linkButtons.push({
      key: 'website',
      label: 'Сайт',
      className: 'social-site',
      href: websiteHref,
    });
  }

  const allButtons = [...linkButtons, ...socialButtons];

  // CTA for pricing block
  // UX: вместо жёсткой ссылки на Telegram/WhatsApp лучше прокрутить до блока
  // "Контакты и соцсети", где родитель сам выберет удобный канал.
  // Если кнопок-контактов нет — тогда используем лучший доступный канал напрямую.
  const ctaHref =
    allButtons.length > 0
      ? "#contacts"
      : ensureUrl(socials?.whatsapp) ||
        ensureUrl(socials?.telegram) ||
        websiteHref ||
        phoneToTelHref(club.phone) ||
        null;

  return (
    <div className="club-main-wrapper">
      {/* Schema.org */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(pageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(clubJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbsJsonLd) }} />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="back-btn">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span>Назад</span>
          </Link>

          <div className="header-title-scroll" id="headerScrollTitle">
            {title}
          </div>

          <button className="back-btn" id="shareBtn" style={{ border: 'none', background: 'none' }} aria-label="Поделиться">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
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
              {category ? <span className="badge category">{category}</span> : null}
              {ageText ? <span className="badge age">{ageText}</span> : null}
            </div>

            <h1 className="main-title">{title}</h1>

            <div className="address-row">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{addressText}</span>
            </div>
          </div>

          {/* Gallery */}
          <ClubGallery photos={club.photos} />

          {/* Pricing (new) or legacy price */}
          {pricingItems.length ? (
            <div className="section-card">
              <PricingBlockClient
                items={pricingItems}
                ctaHref={ctaHref}
                noteText={club.priceNotes ? String(club.priceNotes) : undefined}
              />
            </div>
          ) : (
            <div className="section-card price-card">
              <div className="price-info">
                <h2 className="section-header">Стоимость обучения</h2>
                <div className="price-value">{priceStr}</div>
                {club.priceNotes ? <div className="price-note">{club.priceNotes}</div> : null}
              </div>
            </div>
          )}

          {/* About */}
          <div className="section-card">
            <h2 className="section-header">О кружке</h2>
            <div
              className="section-text"
              dangerouslySetInnerHTML={{
                __html: /<\/?[a-z][\s\S]*>/i.test(String(club.description || ''))
                  ? String(club.description || '')
                  : escapeHtml(String(club.description || '')).replace(/\n/g, '<br/>'),
              }}
            />

            {club.tags?.length > 0 ? (
              <div className="tags-section">
                {club.tags.map((t, i) => (
                  <span key={i} className="tag-chip">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {allButtons.length > 0 ? (
              <div className="social-block" id="contacts">
                <div className="social-title">Контакты и соцсети:</div>

                <div className="social-grid">
                  {allButtons.map((b) => (
                    <a
                      key={b.key}
                      href={b.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`social-btn ${b.className}`}
                    >
                      {b.label}
                    </a>
                  ))}
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
          <ClubMap address={addressText} title={title} lat={club.lat} lon={club.lon} />
        </div>

        {/* Sidebar + Mobile bottom bar */}
        <ClubActions phone={club.phone} />
      </div>
    </div>
  );
}
