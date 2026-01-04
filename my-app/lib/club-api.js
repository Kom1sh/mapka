// lib/club-api.js
//
// ✅ FIX: slug updates become instant
// Раньше страница кружка брала список /api/clubs с revalidate=3600 и искала там slug.
// После смены slug в админке список мог быть закеширован => кружок «не находился» => Next отдавал 404.
//
// Теперь fetchClubData() сначала идёт в /api/clubs/{slug} c cache:"no-store" (всегда свежие данные).
// Фолбэк на список оставлен на случай временных проблем.

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  // основной домен (punycode): https://xn--80aa3agq.xn--p1ai
  "https://xn--80aa3agq.xn--p1ai/api";

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function normalizeClub(raw) {
  if (!raw || typeof raw !== "object") return null;

  const title = raw.title || raw.name || "";
  const address = raw.address || raw.location || "";

  // фото: backend отдаёт image (главная), и иногда images[]
  const photos = Array.isArray(raw.photos)
    ? raw.photos
    : Array.isArray(raw.images)
      ? raw.images
          .map((x) => (typeof x === "string" ? x : x?.url))
          .filter(Boolean)
      : raw.image
        ? [raw.image]
        : [];

  const social = raw.socialLinks || raw.social_links || raw.social || {};
  const schedules = Array.isArray(raw.schedules)
    ? raw.schedules
    : safeJsonParse(raw.schedules, []);

  const lat =
    raw.lat != null && raw.lat !== "" ? Number(raw.lat) : null;
  const lon =
    raw.lon != null && raw.lon !== "" ? Number(raw.lon) : null;

  return {
    // то, что нужно странице кружка
    id: raw.id,
    slug: raw.slug,
    title,
    address,
    description: raw.description || "",
    image: raw.image || photos[0] || "",
    photos,
    price: raw.price_rub ?? raw.price ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    phone: raw.phone || "",
    website: raw.webSite || raw.website || "",
    socialLinks: typeof social === "object" && social ? social : {},
    schedules,
    // coords
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,

    // не ломаем потенциальные поля (если где-то ещё используются)
    _raw: raw,
  };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} for ${url}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchClubs({ limit = 5000, offset = 0 } = {}) {
  const url = `${API_BASE}/clubs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
  // список можно кэшировать — он не критичен для обновления slug страницы
  const data = await fetchJson(url, { next: { revalidate: 60 } });
  if (!Array.isArray(data)) return [];
  return data.map(normalizeClub).filter(Boolean);
}

export async function fetchClubData(slugOrId) {
  const key = String(slugOrId || "").trim();
  if (!key) return null;

  const encoded = encodeURIComponent(key);

  // 1) ✅ прямой запрос (ВСЕГДА свежий) — решает проблему смены slug
  try {
    const directUrl = `${API_BASE}/clubs/${encoded}`;
    const raw = await fetchJson(directUrl, { cache: "no-store" });
    return normalizeClub(raw);
  } catch (e) {
    // если 404 — попробуем фолбэк на список (вдруг это id/старый формат)
    if (e?.status && e.status !== 404) {
      // не-404 ошибки могут быть временными
      // пойдём в фолбэк ниже
    }
  }

  // 2) фолбэк: ищем в списке
  try {
    const clubs = await fetchClubs();
    return clubs.find((c) => c?.slug === key || String(c?.id) === key) || null;
  } catch {
    return null;
  }
}
