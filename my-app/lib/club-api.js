// app/[slug]/club-api.js
// Server-side helper for Club page.
//
// Fixes:
// - Slug updates: fetch by /api/clubs/{slug} first (fresh, no-store)
// - Map breakages: always pass through DB coordinates (lat/lon)
// - Age badge "undefined - undefined": always provide minAge/maxAge numbers
// - Empty category badge: derive category from tags if not provided

import { headers } from "next/headers";

function toNumber(v) {
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

function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = asString(x).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function getOriginFromRequest() {
  // Prefer explicit env if you have it:
  // NEXT_PUBLIC_SITE_ORIGIN=https://xn--80aa3agq.xn--p1ai
  const env = (process.env.NEXT_PUBLIC_SITE_ORIGIN || process.env.SITE_ORIGIN || "").trim();
  if (env) return env.replace(/\/$/, "");

  const h = headers();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

function apiUrl(pathname) {
  const base = (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "").trim().replace(/\/$/, "");
  const origin = base || getOriginFromRequest();

  // If we still cannot determine origin (edge-case), return relative.
  if (!origin) return pathname;

  if (pathname.startsWith("http://") || pathname.startsWith("https://")) return pathname;
  if (!pathname.startsWith("/")) pathname = "/" + pathname;

  // If API base is already full (e.g. https://site.com/api) and pathname starts with /api,
  // avoid double /api.
  if (base && base.endsWith("/api") && pathname.startsWith("/api/")) {
    return base + pathname.slice(4); // remove leading '/api'
  }

  return origin + pathname;
}

function normalizeClub(raw) {
  const tags = asArray(raw?.tags).filter(Boolean).map((x) => asString(x).trim()).filter(Boolean);

  const title = asString(raw?.title || raw?.name).trim();
  const slug = asString(raw?.slug).trim();
  const description = asString(raw?.description).trim();

  // Address naming in backend: location
  const address = asString(raw?.address || raw?.address_text || raw?.location).trim();

  // Coordinates (DB)
  const lat = toNumber(raw?.lat ?? raw?.latitude ?? raw?.address?.lat ?? raw?.address_lat);
  const lon = toNumber(raw?.lon ?? raw?.lng ?? raw?.longitude ?? raw?.address?.lon ?? raw?.address_lon);

  // Age (backend might not store it yet) => keep UI stable
  const minAgeRaw = toNumber(raw?.minAge ?? raw?.ageFrom ?? raw?.age_from ?? raw?.age_min);
  const maxAgeRaw = toNumber(raw?.maxAge ?? raw?.ageTo ?? raw?.age_to ?? raw?.age_max);
  const minAge = minAgeRaw ?? 0;
  const maxAge = maxAgeRaw ?? 99;

  // Category badge — try explicit field, else first tag
  const category = asString(raw?.category || raw?.kind || raw?.type || tags[0] || "").trim();

  // Photos: backend returns `image` (main) and sometimes `images`/`photos`
  const photosFromArrays = asArray(raw?.photos || raw?.images || raw?.gallery)
    .map((p) => (typeof p === "string" ? p : p?.url || p?.src || ""))
    .filter(Boolean);

  const mainImage = asString(raw?.image || raw?.main_image_url || "").trim();
  const photos = uniqStrings([mainImage, ...photosFromArrays]);

  // Social links
  const socialLinks =
    raw?.socialLinks && typeof raw.socialLinks === "object" ? raw.socialLinks :
    raw?.social_links && typeof raw.social_links === "object" ? raw.social_links :
    {};

  // Schedules
  const schedules = asArray(raw?.schedules || raw?.schedule?.items).filter(Boolean);

  // Price
  const priceRub = toNumber(raw?.price_rub ?? raw?.price ?? raw?.priceRub);

  return {
    // identity
    id: asString(raw?.id || raw?._id || ""),
    slug,

    // display fields used by page.jsx / ClubPageClient.jsx
    title: title || asString(raw?.name || ""),
    name: asString(raw?.name || title),
    description,

    address,
    location: address, // keep both aliases

    category,
    minAge,
    maxAge,

    // map
    lat,
    lon,

    // media
    image: photos[0] || "",
    photos,

    // contacts
    phone: asString(raw?.phone || ""),
    webSite: asString(raw?.webSite || raw?.website || raw?.site || ""),
    socialLinks,

    // schedule
    schedules,

    // misc
    tags,
    price: priceRub,
    price_rub: priceRub,
    price_cents: raw?.price_cents ?? null,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    cache: "no-store",
    // For Next.js app router: ensure no caching
    next: { revalidate: 0 },
    headers: {
      accept: "application/json",
    },
    // Important for admin/auth flows if cookies are used
    credentials: "include",
  });

  if (!res.ok) {
    return { ok: false, status: res.status, data: null };
  }

  const data = await res.json();
  return { ok: true, status: res.status, data };
}

export async function fetchClubData(slugOrId) {
  const key = asString(slugOrId).trim();
  if (!key) return null;

  // 1) Fast path: backend supports /api/clubs/{slug}
  const direct = await fetchJson(apiUrl(`/api/clubs/${encodeURIComponent(key)}`));
  if (direct.ok && direct.data) {
    return normalizeClub(direct.data);
  }

  // 2) Fallback: get list and find (keeps things working if proxy/route differs)
  const list = await fetchJson(apiUrl(`/api/clubs?limit=5000&offset=0`));
  if (!list.ok || !Array.isArray(list.data)) return null;

  const found = list.data.find((c) => c?.slug === key || asString(c?.id) === key);
  return found ? normalizeClub(found) : null;
}

export async function getClubSlugs() {
  const list = await fetchJson(apiUrl(`/api/clubs?limit=5000&offset=0`));
  if (!list.ok || !Array.isArray(list.data)) return [];
  return list.data.map((c) => c?.slug).filter(Boolean);
}
