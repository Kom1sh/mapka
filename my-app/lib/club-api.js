// lib/club-api.js
//
// Почему у тебя получался 404 после смены slug:
// этот файл забирал ВЕСЬ список кружков и кэшировал его на 1 час (revalidate: 3600).
// В итоге главная (часто клиентская) могла видеть новый slug, а страница кружка
// (серверная) продолжала жить на закэшированном списке и не находила новый slug.
//
// Fix: один кружок тянем по эндпоинту /api/clubs/{slug} и БЕЗ кэша.

// Если у тебя /api проксируется на бек на текущем домене (Caddy/NGINX),
// оставь пустую строку — будут относительные запросы.
// Если нет — можно задать NEXT_PUBLIC_API_BASE="https://mapkarostov.ru" (БЕЗ /api).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || "";

function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!API_ORIGIN) return p; // same-origin
  return `${API_ORIGIN}${p}`;
}

const DEMO_CLUB = {
  title: "Футбольная Академия 'Чемпион'",
  category: "Спорт",
  minAge: 5,
  maxAge: 16,
  price: 5500,
  priceNotes: "за 12 тренировок",
  address: "г. Ростов-на-Дону, ул. Ленина, д. 42",
  phone: "+79991234567",
  description: "Приглашаем детей от 5 до 16 лет в нашу футбольную школу!",
  tags: ["Футбол", "Спорт", "Команда"],
  photos: ["https://dummyimage.com/1200x800/d1d5db/fff.png&text=No+Photo"],
  schedules: [{ day: "Понедельник", time: "17:00 - 18:30" }],
  socialLinks: { vk: "https://vk.com", telegram: "https://t.me" },
};

function normalizeClub(apiData) {
  if (!apiData) return normalizeClub(DEMO_CLUB);

  const rawPhotos = apiData.image || apiData.photos;
  let photos = [];

  if (Array.isArray(rawPhotos)) {
    photos = rawPhotos;
  } else if (rawPhotos && typeof rawPhotos === 'string') {
    photos = [rawPhotos];
  } else {
    photos = DEMO_CLUB.photos;
  }

  photos = photos.map(p => {
    if (!p) return "";
    if (p.startsWith('http')) return p;
    // относительные медиа-файлы отдаём с того же origin
    if (p.startsWith('/')) return (API_ORIGIN || "https://mapkarostov.ru") + p;
    return p;
  }).filter(Boolean);

  return {
    title: apiData.name || apiData.title || "Без названия",
    category: (apiData.tags && apiData.tags[0]) || "Кружок",
    minAge: apiData.min_age || apiData.minAge || 0,
    maxAge: apiData.max_age || apiData.maxAge || 18,
    price: apiData.price_cents ? Math.round(apiData.price_cents / 100) : (apiData.price || 0),
    priceNotes: apiData.price_note || apiData.priceNotes || "",
    address: apiData.location || apiData.address_text || apiData.address || "Адрес не указан",
    phone: apiData.phone || "",
    description: apiData.description || "",
    schedules: Array.isArray(apiData.schedules) ? apiData.schedules : [],
    socialLinks: apiData.social_links || apiData.socialLinks || {},
    tags: Array.isArray(apiData.tags) ? apiData.tags : [],
    webSite: apiData.site || apiData.webSite || "",
    photos
  };
}

export async function fetchClubData(slug) {
  if (!slug) return null;

  try {
    // 1) Забираем конкретный кружок БЕЗ КЭША — важно для мгновенных обновлений slug.
    const direct = await fetch(apiUrl(`/api/clubs/${encodeURIComponent(String(slug))}`), {
      cache: "no-store",
    });

    if (direct.ok) {
      const club = await direct.json();
      return normalizeClub(club);
    }

    // 404 — реально не нашли
    if (direct.status === 404) return null;

    // 2) Фоллбек: если по какой-то причине прямой эндпоинт недоступен,
    // попробуем список, но тоже без кэша (иначе снова словим старый slug).
    const res = await fetch(apiUrl(`/api/clubs?limit=500&offset=0`), { cache: "no-store" });
    if (!res.ok) return null;
    const list = await res.json();
    const found = list.find((c) => String(c.slug) === String(slug) || String(c.id) === String(slug));
    return found ? normalizeClub(found) : null;
  } catch (e) {
    console.error("Backend unavailable or network error", e);
    // Лучше вернуть null, чем показывать неправильный кружок
    return null;
  }
}