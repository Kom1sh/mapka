"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = ["mapka_favorites", "mapka:favorites", "favorites"];
const PRIMARY_STORAGE_KEY = "mapka_favorites";
const FAVORITES_COOKIE_KEY = "mapka_favorites_ids";

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function setCookie(name, value, days = 90) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAge}; samesite=lax`;
}

function deleteCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function parseCookieIds(csv) {
  return String(csv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function readFavoritesRaw() {
  for (const key of STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v) return safeJsonParse(v);
  }

  // cookie fallback (csv ids)
  const ck = getCookie(FAVORITES_COOKIE_KEY);
  if (ck) return parseCookieIds(ck);

  return null;
}

function persistFavorites(list) {
  const ids = (list || [])
    .map((x) => {
      if (x == null) return null;
      if (typeof x === "string" || typeof x === "number") return String(x);
      return x.id ?? x.clubId ?? x.slug ?? null;
    })
    .filter((x) => x != null)
    .map((x) => String(x));

  // ✅ храним только ids/slugs — FavoritesPageClient сам подтянет данные из API
  localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(ids));

  if (ids.length) setCookie(FAVORITES_COOKIE_KEY, ids.join(","));
  else deleteCookie(FAVORITES_COOKIE_KEY);
}

function normalizeFavoriteItem(item) {
  if (item == null) return null;

  // Если сохраняете id/slug массивом — обработаем отдельно в load()
  if (typeof item === "string" || typeof item === "number") return item;

  const obj = { ...item };
  const id = obj.id ?? obj.clubId ?? null;
  const slug = obj.slug ?? obj.clubSlug ?? (id != null ? String(id) : null);

  const title = obj.title ?? obj.name ?? "";
  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => (typeof t === "string" ? t : t?.name)).filter(Boolean)
    : [];

  const address = obj.address ?? obj.address_text ?? obj.location ?? "";

  const image = obj.image ?? obj.main_image_url ?? obj.photos?.[0] ?? "";

  let price = obj.price;
  if (typeof obj.price_cents === "number") {
    const rub = Math.round(obj.price_cents / 100);
    price = rub > 0 ? `${rub.toLocaleString("ru-RU")} ₽` : "Бесплатно";
  } else if (typeof price === "number") {
    price = price > 0 ? `${price.toLocaleString("ru-RU")} ₽` : "Бесплатно";
  } else if (typeof price !== "string") {
    price = "";
  }

  return {
    id,
    slug,
    title,
    tags,
    address,
    image,
    price,
  };
}

async function fetchAllClubs() {
  const API_BASE = "https://mapkarostov.ru/api";
  const res = await fetch(`${API_BASE}/clubs/`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default function FavoritesPageClient() {
  const [favorites, setFavorites] = useState([]);

  const hasFavorites = favorites.length > 0;

  useEffect(() => {
    (async () => {
      let raw = readFavoritesRaw();

      // Если raw — массив ids/slugs: подтянем данные из API
      if (
        Array.isArray(raw) &&
        raw.length &&
        (typeof raw[0] === "string" || typeof raw[0] === "number")
      ) {
        const all = await fetchAllClubs();
        const wanted = new Set(raw.map((x) => String(x)));
        const matched = all
          .filter((c) => wanted.has(String(c.id)) || wanted.has(String(c.slug)))
          .map((c) => normalizeFavoriteItem(c))
          .filter(Boolean);

        setFavorites(matched);
        return;
      }

      // Если raw — массив объектов
      if (Array.isArray(raw)) {
        const norm = raw.map(normalizeFavoriteItem).filter(Boolean);
        setFavorites(norm);
        return;
      }

      setFavorites([]);
    })();
  }, []);

  const favoriteIds = useMemo(
    () => favorites.map((x) => x?.id).filter((x) => x != null),
    [favorites]
  );

  const removeItem = (id) => {
    // ✅ без confirm — убираем сразу
    setFavorites((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistFavorites(next);
      return next;
    });
  };

  const clearAllFavorites = () => {
    // ✅ без confirm — очищаем сразу
    setFavorites([]);
    for (const key of STORAGE_KEYS) localStorage.removeItem(key);
    deleteCookie(FAVORITES_COOKIE_KEY);
  };

  const shareList = async () => {
    const origin = window.location.origin;
    const ids = favoriteIds.join(",");
    const url = ids
      ? `${origin}/favorites?ids=${encodeURIComponent(ids)}`
      : `${origin}/favorites`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Мои избранные кружки — Мапка",
          text: "Список сохранённых кружков",
          url,
        });
        return;
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(url);
      alert("Ссылка на список скопирована в буфер обмена!");
    } catch {
      alert("Не удалось скопировать ссылку. Вот она:\n" + url);
    }
  };

  return (
    <div className="favorites-scroll">
      <main className="favorites-container">
        <div className="page-header">
          <div className="page-title">
            <h1>Избранное</h1>
            <p>Кружки, которые вы сохранили, чтобы не потерять.</p>
          </div>

          {hasFavorites && (
            <div className="page-actions" id="pageActions">
              <button className="action-btn" onClick={shareList} type="button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                  />
                </svg>
                Поделиться
              </button>

              <button
                className="action-btn danger"
                onClick={clearAllFavorites}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                  />
                </svg>
                Очистить
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        <div
          className={`empty-state ${hasFavorites ? "" : "visible"}`}
          id="emptyState"
        >
          <div className="empty-state-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </div>
          <h2>В избранном пока пусто</h2>
          <p>
            Вы еще не добавляли кружки в избранное. Перейдите на карту или в
            каталог, чтобы найти что-то интересное для вашего ребенка.
          </p>
          <Link href="/" className="primary-btn">
            Перейти к поиску
          </Link>
        </div>

        {/* Grid */}
        <div
          className="favorites-grid"
          id="favoritesGrid"
          style={{ display: hasFavorites ? undefined : "none" }}
        >
          {favorites.map((item) => {
            const href = item.slug ? `/${item.slug}` : "#";
            return (
              <div
                className="club-card"
                key={item.id ?? item.slug ?? item.title}
              >
                <div className="card-image-wrapper">
                  <img
                    src={
                      item.image ||
                      "https://via.placeholder.com/800x500?text=MAPKA"
                    }
                    alt={item.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://via.placeholder.com/800x500?text=MAPKA";
                    }}
                  />

                  <button
                    className="remove-fav-btn"
                    type="button"
                    onClick={() => removeItem(item.id)}
                    title="Удалить из избранного"
                    aria-label="Удалить из избранного"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M6 18L18 6M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="card-content">
                  <div className="card-tags">
                    {(item.tags || []).map((t, i) => (
                      <span className="tag" key={`${t}-${i}`}>
                        {t}
                      </span>
                    ))}
                  </div>

                  <h2 className="card-title">{item.title}</h2>

                  <div className="card-location">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {item.address}
                  </div>

                  <div className="card-footer">
                    <span className="card-price">{item.price || ""}</span>
                    <Link href={href} className="card-btn">
                      Подробнее
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <img
            src="/logo.png"
            alt="Мапка"
            className="footer-logo"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="copyright">© 2025 Мапка. Все права защищены.</div>
          <div className="footer-links">
            <a href="#">Политика конфиденциальности</a>
            <a href="#">Оферта</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
