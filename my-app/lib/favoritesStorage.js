// lib/favoritesStorage.js
const LS_KEY = "mapka_favorites_ids";
const COOKIE_KEY = "mapka_favorites_ids";

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

function setCookie(name, value, days = 90) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}

function parseIds(str) {
  if (!str) return [];
  return str
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function readFavoriteIds() {
  if (typeof window === "undefined") return [];

  // 1) localStorage
  const ls = window.localStorage.getItem(LS_KEY);
  if (ls) return parseIds(ls);

  // 2) cookie fallback
  const ck = getCookie(COOKIE_KEY);
  if (ck) return parseIds(ck);

  return [];
}

export function writeFavoriteIds(ids) {
  if (typeof window === "undefined") return;
  const uniq = Array.from(new Set((ids || []).map(String)));

  const str = uniq.join(",");
  window.localStorage.setItem(LS_KEY, str);
  setCookie(COOKIE_KEY, str, 90);
}

export function isFavorite(key) {
  const id = String(key);
  const ids = readFavoriteIds();
  return ids.includes(id);
}

export function addFavorite(key) {
  const id = String(key);
  const ids = readFavoriteIds();
  if (!ids.includes(id)) {
    ids.push(id);
    writeFavoriteIds(ids);
  }
  return ids;
}

export function removeFavorite(key) {
  const id = String(key);
  const ids = readFavoriteIds().filter((x) => x !== id);
  writeFavoriteIds(ids);
  return ids;
}

export function toggleFavorite(key) {
  const id = String(key);
  const ids = readFavoriteIds();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  writeFavoriteIds(next);
  return next;
}

export function clearFavorites() {
  writeFavoriteIds([]);
}
