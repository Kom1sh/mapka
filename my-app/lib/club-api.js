// club-api.js (fixed)
// Fetch + normalize club data for the club page.
// IMPORTANT: now includes lat/lon so the map can render without client-side geocoding.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://mapkarostov.ru/api";

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeClub(apiData) {
  const tags = Array.isArray(apiData?.tags) ? apiData.tags : [];
  const schedules = Array.isArray(apiData?.schedules) ? apiData.schedules : [];
  const socialLinks = apiData?.socialLinks && typeof apiData.socialLinks === "object" ? apiData.socialLinks : {};

  return {
    id: apiData?.id ?? null,
    slug: apiData?.slug ?? "",
    title: apiData?.name ?? "",
    description: apiData?.description ?? "",
    imageUrl: apiData?.image ?? "",
    address: apiData?.location ?? "",
    // key fix: keep coordinates
    lat: toNum(apiData?.lat),
    lon: toNum(apiData?.lon),

    tags,
    priceRub:
      apiData?.price_rub !== null && apiData?.price_rub !== undefined
        ? Number(apiData.price_rub)
        : apiData?.price_cents !== null && apiData?.price_cents !== undefined
          ? Math.round(Number(apiData.price_cents)) / 100
          : 0,
    phone: apiData?.phone ?? "",
    website: apiData?.webSite ?? "",
    socialLinks,
    schedules,
  };
}

export async function fetchClubData(slug) {
  // Fetch list of clubs once (server-side), find by slug.
  // Use no-store to avoid stale coords after admin updates.
  const res = await fetch(`${API_BASE}/clubs?limit=5000`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const clubs = await res.json();
  const found = Array.isArray(clubs) ? clubs.find((c) => c?.slug === slug) : null;
  if (!found) return null;

  return normalizeClub(found);
}
