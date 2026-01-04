// club-api.js
// Robust club data loader for /[slug] pages.
//
// Key points:
// - Slug changes must appear immediately (no stale cache)
// - Works even if NEXT_PUBLIC_API_BASE is set to origin OR origin + "/api"
// - Tries direct /api/clubs/{slugOrId} and falls back to list /api/clubs

const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_ORIGIN || "").trim();

function normalizeBase(raw) {
  if (!raw) return "";
  let base = String(raw).trim();
  base = base.replace(/\/+$/, "");
  // if someone configured BASE as ".../api" — strip it to avoid "/api/api/..."
  base = base.replace(/\/api\/?$/, "");
  return base;
}

const API_ORIGIN = normalizeBase(RAW_BASE);

function apiUrl(path) {
  if (!path) return API_ORIGIN || "";
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_ORIGIN ? `${API_ORIGIN}${p}` : p;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeClub(apiClub) {
  if (!apiClub || typeof apiClub !== "object") return null;

  const id = apiClub.id != null ? String(apiClub.id) : "";
  const slug = apiClub.slug != null ? String(apiClub.slug) : "";
  const title =
    apiClub.name != null
      ? String(apiClub.name)
      : apiClub.title != null
        ? String(apiClub.title)
        : "";
  const description = apiClub.description != null ? String(apiClub.description) : "";
  const address =
    apiClub.location != null
      ? String(apiClub.location)
      : apiClub.address != null
        ? String(apiClub.address)
        : "";
  const image = apiClub.image != null ? String(apiClub.image) : "";

  const lat = toNumberOrNull(apiClub.lat);
  const lon = toNumberOrNull(apiClub.lon);

  let priceAmount = 0;
  if (apiClub.price_rub != null && apiClub.price_rub !== "") {
    const pr = Number(apiClub.price_rub);
    priceAmount = Number.isFinite(pr) ? pr : 0;
  } else if (apiClub.price_cents != null && apiClub.price_cents !== "") {
    const pc = Number(apiClub.price_cents);
    priceAmount = Number.isFinite(pc) ? Math.round(pc) / 100 : 0;
  }

  const website = apiClub.webSite || apiClub.website || "";
  const phone = apiClub.phone || "";

  let photos = [];
  if (Array.isArray(apiClub.photos)) {
    photos = apiClub.photos.filter(Boolean).map(String);
  } else if (Array.isArray(apiClub.images)) {
    photos = apiClub.images
      .map((x) => (typeof x === "string" ? x : x?.url))
      .filter(Boolean)
      .map(String);
  } else if (image) {
    photos = [image];
  }

  const rating = toNumberOrNull(apiClub.rating) ?? 4.7;
  const reviews = Array.isArray(apiClub.reviews) ? apiClub.reviews : [];

  return {
    id,
    slug,
    title,
    category: apiClub.category ? String(apiClub.category) : "",
    description,
    address,
    rating,
    reviews,
    photos,
    price: {
      type: apiClub.price_type ? String(apiClub.price_type) : "",
      amount: priceAmount,
      unit: "₽",
    },
    contacts: {
      phone: String(phone),
      website: String(website),
    },
    // IMPORTANT: keep both shapes, because different components might use either:
    // - club.coordinates.lat/lon
    // - club.lat/lon
    coordinates: { lat, lon },
    lat,
    lon,
    raw: apiClub,
  };
}

export async function fetchClubData(slugOrId) {
  const key = String(slugOrId ?? "").trim();
  if (!key) return null;

  const encoded = encodeURIComponent(key);

  // 1) Direct endpoint (fast-path)
  try {
    const res = await fetch(apiUrl(`/api/clubs/${encoded}`), {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (res && res.ok) {
      const data = await safeJson(res);
      const norm = normalizeClub(data);
      if (norm) return norm;
    }
  } catch (e) {
    console.warn("[club-api] direct fetch failed:", e);
  }

  // 2) Fallback: list + search (more robust)
  try {
    const res = await fetch(apiUrl(`/api/clubs?limit=5000&offset=0`), {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!res || !res.ok) return null;

    const list = await safeJson(res);
    if (!Array.isArray(list)) return null;

    const found = list.find(
      (c) => String(c?.slug ?? "") === key || String(c?.id ?? "") === key
    );
    if (!found) return null;

    return normalizeClub(found);
  } catch (e) {
    console.warn("[club-api] list fetch failed:", e);
    return null;
  }
}
