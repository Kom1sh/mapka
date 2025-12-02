// map.js — инициализация карт для index.html (десктоп и мобайл)
;(async function initMap() {
  const ymaps3 = window.ymaps3
  if (!ymaps3) {
    console.error("ymaps3 is not available")
    return
  }

  try {
    await ymaps3.ready
  } catch (e) {
    console.error("ymaps3.ready failed", e)
    return
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3

  const rostovLocation = { center: [39.711515, 47.236171], zoom: 12 }
  const GEOCODE_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a"

  const desktopMapContainer = document.getElementById("map")
  const mobileMapContainer = document.getElementById("mobileMap")

  let desktopMap = null
  let mobileMap = null

  if (desktopMapContainer) {
    desktopMap = new YMap(desktopMapContainer, { location: rostovLocation })
    desktopMap.addChild(new YMapDefaultSchemeLayer())
    desktopMap.addChild(new YMapDefaultFeaturesLayer())
  }

  if (mobileMapContainer) {
    mobileMap = new YMap(mobileMapContainer, { location: rostovLocation })
    mobileMap.addChild(new YMapDefaultSchemeLayer())
    mobileMap.addChild(new YMapDefaultFeaturesLayer())
  }

  if (!desktopMap && !mobileMap) {
    console.error("Контейнеры карт не найдены")
    return
  }

  async function geocodeAddress(address) {
    if (!address) return null
    const url = `https://geocode-maps.yandex.ru/1.x/?format=json&geocode=${encodeURIComponent(address)}&apikey=${GEOCODE_API_KEY}&results=1`
    try {
      const r = await fetch(url)
      if (!r.ok) {
        console.warn("Geocode HTTP error", r.status)
        return null
      }
      const json = await r.json()
      const fm = json?.response?.GeoObjectCollection?.featureMember
      if (Array.isArray(fm) && fm.length) {
        const pos = fm[0].GeoObject?.Point?.pos
        if (pos) {
          const [lng, lat] = pos.split(" ").map(Number)
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) return [lng, lat]
        }
      }
      return null
    } catch (err) {
      console.error("Fetch geocode failed", err)
      return null
    }
  }

  function normalizeAddress(str) {
    return (str || "")
      .replace(/^г\.\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  }

  function createMarkerElement(title = "", rawAddress = "") {
    const el = document.createElement("div")
    el.className = "club-marker"
    el.setAttribute("data-address", normalizeAddress(rawAddress))
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      cursor: pointer;
    `

    const lbl = document.createElement("div")
    lbl.className = "club-marker-label"
    lbl.textContent = title || rawAddress || ""
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
    `

    const dot = document.createElement("div")
    dot.className = "club-marker-dot"
    dot.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #69AFDF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      border: 3px solid white;
    `

    el.appendChild(lbl)
    el.appendChild(dot)

    return el
  }

  function addMarkerToBothMaps(coords, title = "", rawAddress = "") {
    const normalizedAddr = normalizeAddress(rawAddress)

    // Метка для десктопной карты
    if (desktopMap) {
      const desktopMarker = createMarkerElement(title, rawAddress)
      desktopMarker.addEventListener("click", () => scrollToCard(normalizedAddr, "desktopCards"))
      desktopMap.addChild(new YMapMarker({ coordinates: coords }, desktopMarker))
    }

    // Метка для мобильной карты
    if (mobileMap) {
      const mobileMarker = createMarkerElement(title, rawAddress)
      mobileMarker.addEventListener("click", () => scrollToCard(normalizedAddr, "mobileCards"))
      mobileMap.addChild(new YMapMarker({ coordinates: coords }, mobileMarker))
    }
  }

  function scrollToCard(normalizedAddr, containerId) {
    const container = document.getElementById(containerId)
    if (!container) return
    const all = Array.from(container.querySelectorAll(".cardLocationText"))
    const target = all.find((x) => normalizeAddress(x.textContent) === normalizedAddr)
    if (target) {
      const card = target.closest(".sectionCard")
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" })
        card.classList.add("highlight-temp")
        setTimeout(() => card.classList.remove("highlight-temp"), 2000)
      }
    }
  }

  // Собираем адреса из карточек (используем только десктопные, т.к. данные одинаковые)
  const els = Array.from(document.querySelectorAll("#desktopCards .cardLocationText"))
  if (!els.length) {
    console.warn("Не найдено .cardLocationText")
    return
  }

  const added = []
  for (const el of els) {
    const raw = el.textContent.trim()
    const title = el.closest(".sectionCard")?.querySelector("h2")?.textContent?.trim() || ""
    const coords = await geocodeAddress(raw)
    if (coords) {
      addMarkerToBothMaps(coords, title, raw)
      added.push(coords)
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  // Центрируем карты на первой метке
  if (added.length) {
    const centerLocation = { center: added[0], zoom: 13 }
    if (desktopMap && typeof desktopMap.setLocation === "function") {
      desktopMap.setLocation(centerLocation)
    }
    if (mobileMap && typeof mobileMap.setLocation === "function") {
      mobileMap.setLocation(centerLocation)
    }
  }
})()
