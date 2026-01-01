// lib/club-api.js

const API_BASE = "https://mapkarostov.ru/api";

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
    if (p.startsWith('/')) return "https://mapkarostov.ru" + p;
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
    // revalidate: 3600 — кэширование на 1 час
    const res = await fetch(`${API_BASE}/clubs`, { next: { revalidate: 3600 } });
    
    if (!res.ok) throw new Error("API Error");
    
    const list = await res.json();
    const found = list.find((c) => String(c.slug) === String(slug) || String(c.id) === String(slug));

    return found ? normalizeClub(found) : null;
  } catch (e) {
    console.error("Backend unavailable or network error", e);
    return normalizeClub(DEMO_CLUB); 
  }
}