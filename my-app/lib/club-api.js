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

function _toNumber(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function _pickCategory(tags) {
  if (!Array.isArray(tags)) return "Кружок";
  // Берём первый «нормальный» тег как категорию.
  const stop = new Set([
    "курсы",
    "мастер-классы",
    "мастерклассы",
    "занятия",
    "групповые занятия",
  ]);
  for (const t of tags) {
    const s = String(t || "").trim();
    if (!s) continue;
    if (stop.has(s.toLowerCase())) continue;
    return s;
  }
  return (String(tags[0] || "").trim() || "Кружок");
}

function _extractAgeRange(text) {
  const t = String(text || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");

  // 1) "от 5 до 16 лет" / "от 1,5 года до 10 лет"
  let m = t.match(/от\s*(\d+(?:[.,]\d+)?)\s*(?:лет|года)?\s*(?:до|\-|—|–)\s*(\d+(?:[.,]\d+)?)\s*(?:лет|года)/i);
  if (m) return { min: _toNumber(m[1]), max: _toNumber(m[2]) };

  // 2) "5-16 лет" / "5 – 16 лет"
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:\-|—|–)\s*(\d+(?:[.,]\d+)?)\s*(?:лет|года)/i);
  if (m) return { min: _toNumber(m[1]), max: _toNumber(m[2]) };

  // 3) "с 5 лет" / "от 5 лет"
  m = t.match(/(?:с|от)\s*(\d+(?:[.,]\d+)?)\s*(?:лет|года)/i);
  if (m) return { min: _toNumber(m[1]), max: null };

  // 4) "до 10 лет"
  m = t.match(/до\s*(\d+(?:[.,]\d+)?)\s*(?:лет|года)/i);
  if (m) return { min: null, max: _toNumber(m[1]) };

  return { min: null, max: null };
}

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
    category: apiData.category || apiData.type || _pickCategory(apiData.tags),
    // Возраст берём: 1) из полей (если есть), 2) пытаемся вытащить из описания, 3) fallback (0..99)
    minAge: (() => {
      const raw = apiData.min_age ?? apiData.minAge ?? apiData.ageFrom ?? apiData.age_from ?? null;
      const n = _toNumber(raw);
      if (n != null) return n;
      const ex = _extractAgeRange(apiData.description);
      return ex.min != null ? ex.min : (ex.max != null ? 0 : 0);
    })(),
    maxAge: (() => {
      const raw = apiData.max_age ?? apiData.maxAge ?? apiData.ageTo ?? apiData.age_to ?? null;
      const n = _toNumber(raw);
      if (n != null) return n;
      const ex = _extractAgeRange(apiData.description);
      if (ex.max != null) return ex.max;
      if (ex.min != null) return 99;
      return 99;
    })(),
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