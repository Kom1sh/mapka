"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ClubCard from "./ClubCard";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ===============================
// Favorites persistence
// ===============================
const FAVORITES_STORAGE_KEY = "mapka_favorites";
const FAVORITES_COOKIE_KEY = "mapka_favorites_ids";

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function setCookie(name, value, days = 90) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function deleteCookie(name) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function normalizeFavoriteIds(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];

  if (raw.length && (typeof raw[0] === "string" || typeof raw[0] === "number")) {
    return raw.map((x) => String(x)).filter(Boolean);
  }

  return raw
    .map((x) => x?.id ?? x?.clubId ?? x?.slug)
    .filter((x) => x != null)
    .map((x) => String(x));
}

function readFavoriteIds() {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (v) {
      const parsed = JSON.parse(v);
      const ids = normalizeFavoriteIds(parsed);
      if (ids.length) return ids;
    }
  } catch {
    // ignore
  }

  const ck = getCookie(FAVORITES_COOKIE_KEY);
  if (!ck) return [];
  return ck
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function writeFavoriteIds(ids) {
  if (typeof window === "undefined") return;
  const uniq = Array.from(new Set((ids || []).map(String))).filter(Boolean);

  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniq));
  } catch {
    // ignore
  }

  if (uniq.length) setCookie(FAVORITES_COOKIE_KEY, uniq.join(","));
  else deleteCookie(FAVORITES_COOKIE_KEY);
}

export default function ClubListClient({ initialClubs = [] }) {
  // Data
  const [allClubs, setAllClubs] = useState(() =>
    Array.isArray(initialClubs) ? initialClubs : []
  );
  const [filteredClubs, setFilteredClubs] = useState(() =>
    Array.isArray(initialClubs) ? initialClubs : []
  );

  // ✅ Init isFavorite from storage (localStorage/cookie)
  useEffect(() => {
    const fav = new Set(readFavoriteIds());
    if (!fav.size) return;

    setAllClubs((prev) =>
      (prev || []).map((c) => ({
        ...c,
        isFavorite: fav.has(String(c.id)),
      }))
    );

    setFilteredClubs((prev) =>
      (prev || []).map((c) => ({
        ...c,
        isFavorite: fav.has(String(c.id)),
      }))
    );
  }, []);

  // ✅ Map ready flag (for markers)
  const [mapsReady, setMapsReady] = useState(false);

  // UI state
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]); // lower-case
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(5000); // RUB
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const [tagSearch, setTagSearch] = useState("");
  const [tagSearchFocused, setTagSearchFocused] = useState(false);

  const [desktopPanelCollapsed, setDesktopPanelCollapsed] = useState(false);
  const [panelHeaderScrolled, setPanelHeaderScrolled] = useState(false);

  // Map refs
  const desktopMapRef = useRef(null);
  const mobileMapRef = useRef(null);
  const mapsReadyRef = useRef(false);
  const markersAddedRef = useRef(false);

  // Bottom sheet refs (mobile)
  const bottomSheetRef = useRef(null);
  const sheetHandleRef = useRef(null);

  const lastTranslateYRef = useRef(0);
  const startYRef = useRef(0);
  const startTranslateYRef = useRef(0);
  const draggingRef = useRef(false);
  const offsetsRef = useRef({ peek: 0, split: 0, full: 0 });
  const sheetStateIndexRef = useRef(1); // 0 peek, 1 split, 2 full

  const STATE_ORDER = ["peek", "split", "full"];

  // Build tags + max price
  const { allTags, maxPriceFromDB } = useMemo(() => {
    const tagSet = new Set();
    let maxRub = 0;

    for (const c of allClubs || []) {
      const tags = Array.isArray(c.tags) ? c.tags : [];
      tags.forEach((t) => tagSet.add(String(t).toLowerCase()));

      const rub = Math.round((c.price_cents || 0) / 100);
      if (rub > maxRub) maxRub = rub;
    }

    return {
      allTags: Array.from(tagSet).sort(),
      maxPriceFromDB: maxRub > 0 ? maxRub : 5000,
    };
  }, [allClubs]);

  // Init maxPrice by DB range
  useEffect(() => {
    setMaxPrice((prev) => {
      if (typeof prev !== "number" || Number.isNaN(prev)) return maxPriceFromDB;
      if (prev === 5000 && maxPriceFromDB !== 5000) return maxPriceFromDB;
      return Math.min(prev, maxPriceFromDB);
    });
  }, [maxPriceFromDB]);

  // Apply filters
  const applyFilters = () => {
    const q = String(searchQuery || "").trim().toLowerCase();
    const tags = selectedTags || [];
    const maxCents = (maxPrice || 0) * 100;

    const result = (allClubs || []).filter((club) => {
      const name = String(club.name || "").toLowerCase();
      if (q && !name.includes(q)) return false;

      const priceCents = club.price_cents || 0;
      if (priceCents > maxCents) return false;

      if (tags.length > 0) {
        const clubTags = (club.tags || []).map((t) => String(t).toLowerCase());
        if (!tags.every((t) => clubTags.includes(t))) return false;
      }

      return true;
    });

    setFilteredClubs(result);
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedTags, maxPrice, allClubs]);

  // Lock body scroll when filter panel open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (filterOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filterOpen]);

  // ✅ Init maps (desktop + mobile) — client only
  useEffect(() => {
    let cancelled = false;

    const initMaps = async () => {
      // Wait for ymaps3
      for (let i = 0; i < 60; i++) {
        if (typeof window !== "undefined" && window.ymaps3) break;
        await sleep(100);
      }
      if (cancelled) return;
      if (typeof window === "undefined" || !window.ymaps3) return;

      try {
        await window.ymaps3.ready;
      } catch {
        return;
      }
      if (cancelled) return;

      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = window.ymaps3;
      const rostov = { center: [39.711515, 47.236171], zoom: 12 };

      const desktopContainer = document.getElementById("map");
      if (desktopContainer && !desktopMapRef.current) {
        const map = new YMap(desktopContainer, { location: rostov });
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());
        desktopMapRef.current = map;
      }

      const mobileContainer = document.getElementById("mobileMap");
      if (mobileContainer && !mobileMapRef.current) {
        const map = new YMap(mobileContainer, { location: rostov });
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());
        mobileMapRef.current = map;
      }

      mapsReadyRef.current = !!(desktopMapRef.current || mobileMapRef.current);

      // ✅ Trigger marker effect again
      if (mapsReadyRef.current) setMapsReady(true);
    };

    initMaps();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ Add markers only after mapsReady
  // ВАЖНО: координаты берём с бэка (club.lat / club.lon). Геокодинг на фронте убран.
  useEffect(() => {
    if (!mapsReady) return;

    let cancelled = false;

    const createMarkerElement = (title = "", rawAddress = "") => {
      const el = document.createElement("div");
      el.className = "club-marker";
      el.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
        cursor: pointer;
      `;

      const lbl = document.createElement("div");
      lbl.className = "club-marker-label";
      lbl.textContent = title || rawAddress || "";
      lbl.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: #111;
        background: rgba(255,255,255,0.95);
        padding: 6px 12px;
        border-radius: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        white-space: nowrap;
        margin-bottom: 6px;
      `;

      const dot = document.createElement("div");
      dot.className = "club-marker-dot";
      dot.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #69AFDF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        border: 3px solid white;
      `;

      el.appendChild(lbl);
      el.appendChild(dot);
      return el;
    };

    const scrollToClubCard = (id) => {
      setDesktopPanelCollapsed(false);
      const card = document.getElementById(`club-card-${id}`);
      if (!card) return;

      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight-temp");
      setTimeout(() => card.classList.remove("highlight-temp"), 2000);
    };

    window.selectClubFromMap = scrollToClubCard;

    const addMarkers = async () => {
      if (!mapsReadyRef.current) return;
      if (!window.ymaps3) return;
      if (markersAddedRef.current) return;

      const { YMapMarker } = window.ymaps3;

      const added = [];
      for (const club of allClubs || []) {
        if (cancelled) return;

        // ✅ ожидаем lat/lon из API
        const lat = club.lat ?? club.latitude ?? null;
        const lon = club.lon ?? club.lng ?? club.longitude ?? null;

        if (lat == null || lon == null) continue;

        const lt = Number(lat);
        const lg = Number(lon);
        if (Number.isNaN(lt) || Number.isNaN(lg)) continue;

        const coords = [lg, lt];

        const title = club.name || "";
        const addr = club.location || club.address_text || "";

        if (desktopMapRef.current) {
          const el = createMarkerElement(title, addr);
          el.addEventListener("click", () => scrollToClubCard(club.id));
          desktopMapRef.current.addChild(new YMapMarker({ coordinates: coords }, el));
        }

        if (mobileMapRef.current) {
          const el = createMarkerElement(title, addr);
          el.addEventListener("click", () => scrollToClubCard(club.id));
          mobileMapRef.current.addChild(new YMapMarker({ coordinates: coords }, el));
        }

        added.push(coords);
        await sleep(50);
      }

      if (added.length) {
        const loc = { center: added[0], zoom: 13 };
        if (desktopMapRef.current?.setLocation) desktopMapRef.current.setLocation(loc);
        if (mobileMapRef.current?.setLocation) mobileMapRef.current.setLocation(loc);
      }

      markersAddedRef.current = true;
    };

    addMarkers();

    return () => {
      cancelled = true;
    };
  }, [allClubs, mapsReady]);

  // Bottom sheet drag (mobile)
  useEffect(() => {
    const sheet = bottomSheetRef.current;
    const handle = sheetHandleRef.current;
    if (!sheet || !handle) return;

    const recomputeOffsets = () => {
      const h = sheet.getBoundingClientRect().height;
      offsetsRef.current.full = 0;
      offsetsRef.current.peek = Math.max(0, h - 84);
      offsetsRef.current.split = Math.round(h / 2);
    };

    const applyStateIndex = (idx) => {
      sheetStateIndexRef.current = Math.min(
        Math.max(idx, 0),
        STATE_ORDER.length - 1
      );
      const key = STATE_ORDER[sheetStateIndexRef.current];
      const y = offsetsRef.current[key];

      lastTranslateYRef.current = y;
      sheet.style.transition = "transform 0.25s ease-out";
      sheet.style.transform = `translateY(${y}px)`;

      sheet.classList.remove("peek", "split", "full");
      sheet.classList.add(key);
    };

    recomputeOffsets();
    applyStateIndex(sheetStateIndexRef.current);

    const onResize = () => {
      recomputeOffsets();
      applyStateIndex(sheetStateIndexRef.current);
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      draggingRef.current = true;
      startYRef.current = e.touches[0].clientY;
      startTranslateYRef.current = lastTranslateYRef.current;
      sheet.style.transition = "none";
    };

    const onTouchMove = (e) => {
      if (!draggingRef.current) return;
      const deltaY = e.touches[0].clientY - startYRef.current;

      const minY = offsetsRef.current.full;
      const maxY = offsetsRef.current.peek;

      let nextY = startTranslateYRef.current + deltaY;
      if (nextY < minY) nextY = minY;
      if (nextY > maxY) nextY = maxY;

      lastTranslateYRef.current = nextY;
      sheet.style.transform = `translateY(${nextY}px)`;
      e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      sheet.style.transition = "transform 0.25s ease-out";
      recomputeOffsets();

      let nearestIndex = 0;
      let nearestDist = Infinity;

      STATE_ORDER.forEach((key, idx) => {
        const d = Math.abs(lastTranslateYRef.current - offsetsRef.current[key]);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIndex = idx;
        }
      });

      applyStateIndex(nearestIndex);
    };

    const onHandleClick = () => {
      if (draggingRef.current) return;
      const next = (sheetStateIndexRef.current + 1) % STATE_ORDER.length;
      applyStateIndex(next);
    };

    window.addEventListener("resize", onResize);
    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    handle.addEventListener("click", onHandleClick);

    return () => {
      window.removeEventListener("resize", onResize);
      handle.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      handle.removeEventListener("click", onHandleClick);
    };
  }, []);

  // Tag suggestions
  const tagSuggestions = useMemo(() => {
    const q = String(tagSearch || "").trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter((t) => t.includes(q) && !selectedTags.includes(t))
      .slice(0, 10);
  }, [tagSearch, allTags, selectedTags]);

  const showSuggestions = tagSearchFocused && tagSuggestions.length > 0;

  const toggleFilterTag = (tag) => {
    const t = String(tag || "").toLowerCase();
    setSelectedTags((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      return [...prev, t];
    });
  };

  const addTag = (tag) => {
    const t = String(tag || "").toLowerCase();
    setSelectedTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };

  const removeTag = (tag) => {
    const t = String(tag || "").toLowerCase();
    setSelectedTags((prev) => prev.filter((x) => x !== t));
  };

  const removePriceFilter = () => {
    setMaxPrice(maxPriceFromDB);
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setMaxPrice(maxPriceFromDB);
    setSearchQuery("");
    setTagSearch("");
  };

  const toggleFavorite = (id) => {
    // ✅ toggle in state
    setAllClubs((prev) => {
      const next = (prev || []).map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      );

      // ✅ persist (ids only)
      const ids = next.filter((c) => c.isFavorite).map((c) => String(c.id));
      writeFavoriteIds(ids);

      return next;
    });

    // ✅ instant update in filtered list
    setFilteredClubs((prev) =>
      (prev || []).map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
  };

  const sliderPercent =
    maxPriceFromDB > 0
      ? Math.max(0, Math.min(100, (maxPrice / maxPriceFromDB) * 100))
      : 100;

  const ActiveChips = () => (
    <>
      {selectedTags.map((t) => (
        <div className="active-filter-chip" key={t}>
          {t}
          <button type="button" onClick={() => removeTag(t)} aria-label="Удалить тег">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {maxPrice < maxPriceFromDB && (
        <div className="active-filter-chip">
          До {maxPrice.toLocaleString("ru-RU")} ₽
          <button type="button" onClick={removePriceFilter} aria-label="Сбросить цену">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Layout */}
      <main className="main-desktop">
        <div className="map-container">
          <div id="map" />
        </div>

        <div className={`left-panel ${desktopPanelCollapsed ? "collapsed" : ""}`} id="leftPanel">
          <div className="cards-container">
            <div className={`panel-header-area ${panelHeaderScrolled ? "scrolled" : ""}`} id="panelHeaderArea">
              <div className="home-title-wrap">
                <h1 className="home-title">
                  Кружки и секции для детей в Ростове-на-Дону{" "}
                  <span className="home-title__dash">—</span>{" "}
                  <span className="home-title__brand">Мапка</span>
                </h1>
                <p className="home-subtitle">
                  Выбирайте кружки на карте или используйте поиск и фильтры по тегам и цене.
                </p>
              </div>

              <div className="search-filter">
                <button className="filter-btn" id="desktopFilterBtn" type="button" onClick={() => setFilterOpen(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                  </svg>
                  <span className="filter-text">Фильтры</span>
                </button>

                <div className="search-box">
                  <div className="search-icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </div>

                  <input
                    type="search"
                    placeholder="Поиск кружков..."
                    id="desktopSearchInput"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="active-filters" id="desktopActiveFilters">
                <ActiveChips />
              </div>
            </div>

            <div
              className="desktop-panel-handle"
              id="desktopPanelHandle"
              role="button"
              tabIndex={0}
              onClick={() => setDesktopPanelCollapsed((v) => !v)}
              onKeyDown={(e) => e.key === "Enter" && setDesktopPanelCollapsed((v) => !v)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </div>

            <div
              className="cards-scroll"
              id="cardsScrollContainer"
              onScroll={(e) => setPanelHeaderScrolled(e.currentTarget.scrollTop > 0)}
            >
              <div className="cards-list" id="desktopCards">
                {filteredClubs && filteredClubs.length > 0 ? (
                  filteredClubs.map((club) => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      titleTag="h2"
                      onTagClick={addTag}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))
                ) : (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>
                    Кружки не найдены
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Layout */}
      <main className="main-mobile">
        <div className="mobile-map">
          <div id="mobileMap" />
        </div>

        <div className="bottom-sheet split" id="bottomSheet" ref={bottomSheetRef}>
          <div className="sheet-handle" id="sheetHandle" ref={sheetHandleRef}>
            <div className="handle-bar" />
          </div>

          <div className="sheet-header">
            <div className="search-filter">
              <button className="filter-btn" id="mobileFilterBtn" type="button" onClick={() => setFilterOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                </svg>
              </button>

              <div className="search-box">
                <div className="search-icon-wrapper" style={{ paddingLeft: 8 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>

                <input
                  type="search"
                  placeholder="Поиск..."
                  id="mobileSearchInput"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="sheet-content">
            <div className="active-filters" id="mobileActiveFilters">
              <ActiveChips />
            </div>

            <div className="sheet-cards" id="mobileCards">
              {filteredClubs && filteredClubs.length > 0 ? (
                filteredClubs.map((club) => (
                  <ClubCard
                    key={`m-${club.id}`}
                    club={club}
                    titleTag="div"
                    onTagClick={addTag}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
              ) : (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>
                  Кружки не найдены
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Filter panel */}
      <div className={`filter-panel ${filterOpen ? "active" : ""}`} id="filterPanel">
        <div className="filter-panel-header">
          <div className="filter-panel-title">Фильтры</div>
          <button className="icon-btn" type="button" onClick={() => setFilterOpen(false)} aria-label="Закрыть фильтры">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="filter-panel-content">
          <div className="filter-section">
            <div className="filter-section-title">Теги</div>

            <div className="tag-search-container">
              <input
                type="text"
                className="tag-search-input"
                placeholder="Поиск тегов..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onFocus={() => setTagSearchFocused(true)}
                onBlur={() => setTimeout(() => setTagSearchFocused(false), 150)}
                id="tagSearchInput"
              />

              <div className={`tag-suggestions ${showSuggestions ? "active" : ""}`} id="tagSuggestions">
                {tagSuggestions.map((t) => (
                  <div
                    className="tag-suggestion-item"
                    key={t}
                    onMouseDown={() => {
                      addTag(t);
                      setTagSearch("");
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="filter-tags-wrapper">
              <div className={`filter-tags ${tagsExpanded ? "expanded" : ""}`} id="filterTags">
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`filter-tag ${selectedTags.includes(t) ? "active" : ""}`}
                    data-tag={t}
                    onClick={() => toggleFilterTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {!!allTags.length && (
                <button
                  className={`tags-expand-btn ${tagsExpanded ? "expanded" : ""}`}
                  id="tagsExpandBtn"
                  type="button"
                  onClick={() => setTagsExpanded((v) => !v)}
                >
                  <span className="expand-text">{tagsExpanded ? "Свернуть" : "Показать все"}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">Цена за занятие</div>

            <div className="price-slider-container">
              <div className="price-range-labels">
                <span>0 ₽</span>
                <span id="maxPriceLabel">{maxPriceFromDB.toLocaleString("ru-RU")} ₽</span>
              </div>

              <input
                type="range"
                className="price-slider"
                id="priceSlider"
                min="0"
                max={maxPriceFromDB}
                value={maxPrice}
                step="100"
                onInput={(e) => setMaxPrice(parseInt(e.target.value, 10))}
                style={{ "--slider-percent": `${sliderPercent}%` }}
              />

              <div className="price-current">
                До{" "}
                <span id="currentPriceValue">
                  {maxPrice === 0 ? "Бесплатно" : maxPrice.toLocaleString("ru-RU")}
                </span>{" "}
                ₽
              </div>
            </div>
          </div>
        </div>

        <div className="filter-panel-footer">
          <button className="filter-reset-btn" id="filterResetBtn" type="button" onClick={resetFilters}>
            Сбросить
          </button>
          <button className="filter-apply-btn" id="filterApplyBtn" type="button" onClick={() => setFilterOpen(false)}>
            Показать результаты
          </button>
        </div>
      </div>

      {/* ✅ Стили H1 (без правок globals.css) */}
      <style jsx global>{`
        .home-title-wrap {
          margin: 10px 0 12px;
          padding: 14px 16px 12px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.06);
        }

        .home-title {
          margin: 0;
          font-size: clamp(18px, 1.2vw + 14px, 28px);
          line-height: 1.12;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          text-wrap: balance;
        }

        .home-title__brand {
          color: var(--accent-color);
          font-weight: 900;
        }

        .home-title__dash {
          color: var(--text-secondary);
          font-weight: 800;
        }

        .home-subtitle {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }

        @media (max-width: 420px) {
          .home-title-wrap {
            padding: 12px 14px 10px;
            border-radius: 16px;
          }
          .home-subtitle {
            font-size: 12px;
          }
        }

        .filter-panel-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .filter-section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
        }
      `}</style>
    </>
  );
}
