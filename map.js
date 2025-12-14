// map.js — интеграция с бэкендом mapka API (использует createCardHTML из index.html если есть)
;(async function initMap() {
  const ymaps3 = window.ymaps3;
  if (!ymaps3) {
    console.error("ymaps3 is not available");
    return;
  }

  try {
    await ymaps3.ready;
  } catch (e) {
    console.error("ymaps3.ready failed", e);
    return;
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

  const rostovLocation = { center: [39.711515, 47.236171], zoom: 12 };

  const desktopMapContainer = document.getElementById("map");
  const mobileMapContainer = document.getElementById("mobileMap");

  let desktopMap = null;
  let mobileMap = null;

  if (desktopMapContainer) {
    desktopMap = new YMap(desktopMapContainer, { location: rostovLocation });
    desktopMap.addChild(new YMapDefaultSchemeLayer());
    desktopMap.addChild(new YMapDefaultFeaturesLayer());
  }

  if (mobileMapContainer) {
    mobileMap = new YMap(mobileMapContainer, { location: rostovLocation });
    mobileMap.addChild(new YMapDefaultSchemeLayer());
    mobileMap.addChild(new YMapDefaultFeaturesLayer());
  }

  if (!desktopMap && !mobileMap) {
    console.error("Контейнеры карт не найдены");
    return;
  }

  // ====== Автоопределение API_BASE / API_ORIGIN (локально или через ngrok) ======
  const API_BASE = (function(){
    try {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        return "http://localhost:8000/api";
      }
      return `${location.protocol}//${location.host}/api`;
    } catch(e) {
      return "http://localhost:8000/api";
    }
  })();

  const API_ORIGIN = (function(){
    try {
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
        return "http://localhost:8000";
      }
      return `${location.protocol}//${location.host}`;
    } catch(e){
      return "http://localhost:8000";
    }
  })();

  console.log("map.js using API_BASE =", API_BASE, "API_ORIGIN =", API_ORIGIN);
  // ==========================================================================

  async function geocodeAddress(address) {
    if (!address) return null;
    const GEOCODE_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a";
    const url = `https://geocode-maps.yandex.ru/1.x/?format=json&geocode=${encodeURIComponent(address)}&apikey=${GEOCODE_API_KEY}&results=1`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn("Geocode HTTP error", r.status);
        return null;
      }
      const json = await r.json();
      const fm = json?.response?.GeoObjectCollection?.featureMember;
      if (Array.isArray(fm) && fm.length) {
        const pos = fm[0].GeoObject?.Point?.pos;
        if (pos) {
          const [lng, lat] = pos.split(" ").map(Number);
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) return [lng, lat];
        }
      }
      return null;
    } catch (err) {
      console.error("Fetch geocode failed", err);
      return null;
    }
  }

  function normalizeAddress(str) {
    return (str || "")
      .replace(/^г\.\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function createMarkerElement(title = "", rawAddress = "") {
    const el = document.createElement("div");
    el.className = "club-marker";
    el.setAttribute("data-address", normalizeAddress(rawAddress));
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
  }

  function addMarkerToBothMaps(coords, title = "", rawAddress = "") {
    const normalizedAddr = normalizeAddress(rawAddress);

    if (desktopMap) {
      const desktopMarker = createMarkerElement(title, rawAddress);
      desktopMarker.addEventListener("click", () => scrollToCard(normalizedAddr, "desktopCards"));
      desktopMap.addChild(new YMapMarker({ coordinates: coords }, desktopMarker));
    }

    if (mobileMap) {
      const mobileMarker = createMarkerElement(title, rawAddress);
      mobileMarker.addEventListener("click", () => scrollToCard(normalizedAddr, "mobileCards"));
      mobileMap.addChild(new YMapMarker({ coordinates: coords }, mobileMarker));
    }
  }

  function scrollToCard(normalizedAddr, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const all = Array.from(container.querySelectorAll(".cardLocationText"));
    const target = all.find((x) => normalizeAddress(x.textContent) === normalizedAddr);
    if (target) {
      const card = target.closest(".sectionCard");
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("highlight-temp");
        setTimeout(() => card.classList.remove("highlight-temp"), 2000);
      }
    }
  }

  // Use existing createCardHTML from page if present (index.html), otherwise provide fallback identical to your markup
  const pageHasCreateCardHTML = (typeof window.createCardHTML === "function");
  if (!pageHasCreateCardHTML) {
    // fallback identical to index.html's function
    window.createCardHTML = function createCardHTML(club) {
      return `
        <div class="club-card sectionCard">
          <div class="card-top">
            <div class="card-image">
              <img src="${club.image}" alt="${club.name}">
              <button class="favorite-btn ${club.isFavorite ? 'active' : ''}" data-id="${club.id}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </button>
            </div>
            <div class="card-content">
              <h2 class="card-title">${"${club.name}"}</h2>
              <div class="card-description">${"${club.description}"}</div>
            </div>
          </div>
          <div class="card-tags">
            ${"${(club.tags||[]).map(tag => `<button class='tag-btn'>${tag}</button>`).join('')}"}
          </div>
          <div class="card-bottom">
            <div class="card-location">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span class="cardLocationText">${"${club.location}"}</span>
            </div>
            <div class="card-buttons">
              <a href="/${encodeURIComponent(club.slug)}" class="club-card-more">Подробнее</a>
              <button class="card-btn">Написать</button>
            </div>
          </div>
        </div>
      `;
    };
  }

  // small helper to avoid XSS if any data not trusted
  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // load and render
  async function loadAndRenderClubs() {
    let clubs = [];
    try {
      const res = await fetch(`${API_BASE}/clubs`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      clubs = await res.json();
    } catch (err) {
      console.error("Не удалось загрузить клубы с API:", err);
      const errNode = document.createElement("div");
      errNode.style.padding = "12px";
      errNode.style.color = "#900";
      errNode.textContent = "Не удалось загрузить список кружков.";
      const container = document.getElementById("desktopCards");
      if (container) container.appendChild(errNode);
      return;
    }

    // prepare objects exactly as frontend expects
    const prepared = clubs.map(c => {
      // image normalization: prefer 'image' if provided by API, else main_image_url / images[0]
      let img = c.image || c.main_image_url || (c.images && c.images[0] && c.images[0].url) || "";
      // if relative path (starts with '/'), prefix API_ORIGIN so URL becomes absolute
      if (img && img.startsWith("/")) img = API_ORIGIN.replace(/\/$/, "") + img;

      // tags fallback
      const tags = c.tags || [];

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image: img,
        location: (c.location || c.address_text || (c.address && ((c.address.street?c.address.street:"") + (c.address.city?(", "+c.address.city):"")) ) || ""),
        isFavorite: !!c.isFavorite,
        tags: tags,
        lat: c.lat || null,
        lon: c.lon || null,
      };
    });

    // render using page's createCardHTML
    const desktopContainer = document.getElementById("desktopCards");
    const mobileContainer = document.getElementById("mobileCards");
    try {
      if (desktopContainer) desktopContainer.innerHTML = prepared.map(club => window.createCardHTML(club)).join("");
      if (mobileContainer) mobileContainer.innerHTML = prepared.map(club => window.createCardHTML(club)).join("");
    } catch (e) {
      console.error("Rendering error:", e);
    }

    // add markers — use coords when present, otherwise geocode address
    const added = [];
    for (const club of prepared) {
      let coords = null;
      if (club.lat !== null && club.lon !== null) {
        coords = [club.lon, club.lat]; // [lng, lat]
      } else if (club.location) {
        coords = await geocodeAddress(club.location);
      }
      if (coords) {
        addMarkerToBothMaps(coords, club.name, club.location);
        added.push(coords);
      }
      // throttle geocode requests (avoid rate limits)
      await new Promise((r) => setTimeout(r, 200));
    }

    // center maps on first marker
    if (added.length) {
      const centerLocation = { center: added[0], zoom: 13 };
      if (desktopMap && typeof desktopMap.setLocation === "function") {
        desktopMap.setLocation(centerLocation);
      }
      if (mobileMap && typeof mobileMap.setLocation === "function") {
        mobileMap.setLocation(centerLocation);
      }
    }
  }

  // run
  await loadAndRenderClubs();

  // delegate click: scroll to card by address when marker/card clicked
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".sectionCard");
    if (!card) return;
    const addrNode = card.querySelector(".cardLocationText");
    if (!addrNode) return;
    const norm = normalizeAddress(addrNode.textContent);
    scrollToCard(norm, "desktopCards");
  });
})();
