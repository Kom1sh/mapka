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

function toNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v != null && v !== "") return v;
  }
  return null;
}

function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .map((t) =>
      typeof t === "string"
        ? t.trim()
        : typeof t?.name === "string"
          ? t.name.trim()
          : ""
    )
    .filter(Boolean);
}

function normalizeCategory(raw) {
  // backend может отдавать строку или объект {name}
  const c = raw?.category;
  const v =
    (typeof c === "string" ? c : typeof c?.name === "string" ? c.name : null) ||
    raw?.category_name ||
    raw?.type ||
    raw?.direction ||
    raw?.section ||
    raw?.kind ||
    null;

  return typeof v === "string" ? v.trim() : "";
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

  const lat = raw.lat != null && raw.lat !== "" ? Number(raw.lat) : null;
  const lon = raw.lon != null && raw.lon !== "" ? Number(raw.lon) : null;

  // ✅ ДОБАВИЛИ нормализацию полей (чтобы не было "undefined" и пустых бейджей)
  const category = normalizeCategory(raw);
  const minAge = toNum(
    pickFirst(raw.minAge, raw.min_age, raw.age_min, raw.ageFrom, raw.age_from)
  );
  const maxAge = toNum(
    pickFirst(raw.maxAge, raw.max_age, raw.age_max, raw.ageTo, raw.age_to)
  );
  const priceNotes =
    pickFirst(raw.priceNotes, raw.price_notes, raw.price_note, raw.note_price) ||
    "";
  const tags = normalizeTags(raw.tags);

  // ✅ pricing cards (мульти-тарифы). Нужны для нового блока стоимости на странице кружка
  const pricing = Array.isArray(raw.pricing)
    ? raw.pricing
    : safeJsonParse(raw.pricing, []);

  return {
    // то, что нужно странице кружка
    id: raw.id,
    slug: raw.slug,
    title,
    address,

    category,

    description: raw.description || "",
    image: raw.image || photos[0] || "",
    photos,

    price: raw.price_rub ?? raw.price ?? null,
    priceNotes,

    pricing,

    minAge,
    maxAge,

    tags,

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
  const url = `${API_BASE}/clubs?limit=${encodeURIComponent(
    limit
  )}&offset=${encodeURIComponent(offset)}`;
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
    return (
      clubs.find((c) => c?.slug === key || String(c?.id) === key) || null
    );
  } catch {
    return null;
  }
}
