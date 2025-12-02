// club-map.js — инициализация карты для страницы отдельного клуба
// Карта центрируется на адресе клуба

const GEOCODE_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a"
const ymaps3 = window.ymaps3 // Declare the ymaps3 variable

async function geocodeAddress(address) {
  if (!address) return null
  const url = `https://geocode-maps.yandex.ru/1.x/?format=json&geocode=${encodeURIComponent(address)}&apikey=${GEOCODE_API_KEY}&results=1`
  try {
    const r = await fetch(url)
    if (!r.ok) return null
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
    console.error("Geocode error:", err)
    return null
  }
}

function createMarkerElement(title) {
  const el = document.createElement("div")
  el.className = "custom-marker"
  el.style.position = "relative"

  const wrapper = document.createElement("div")
  wrapper.style.display = "flex"
  wrapper.style.flexDirection = "column"
  wrapper.style.alignItems = "center"

  // Подпись
  const lbl = document.createElement("div")
  lbl.className = "custom-marker-label"
  lbl.textContent = title

  // Точка
  const dot = document.createElement("div")
  dot.className = "custom-marker-dot"

  wrapper.appendChild(lbl)
  wrapper.appendChild(dot)
  el.appendChild(wrapper)

  return el
}

// Глобальная функция для инициализации карты клуба
window.initClubMap = async (address, title) => {
  const mapContainer = document.getElementById("map")
  if (!mapContainer) {
    console.warn("Map container #map not found")
    return
  }

  try {
    await ymaps3.ready
  } catch (e) {
    console.error("ymaps3.ready failed", e)
    mapContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Не удалось загрузить карту</p>'
    return
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3

  // Дефолтные координаты Ростова-на-Дону
  let coords = [39.711515, 47.236171]
  let zoom = 12

  // Геокодируем адрес клуба
  if (address) {
    const cleanAddress = address.replace(/^г\.\s*/i, "").trim()
    const geocoded = await geocodeAddress(cleanAddress)
    if (geocoded) {
      coords = geocoded
      zoom = 16 // Приближаем к конкретному месту
    }
  }

  const map = new YMap(mapContainer, { location: { center: coords, zoom: zoom } })
  map.addChild(new YMapDefaultSchemeLayer())
  map.addChild(new YMapDefaultFeaturesLayer())

  // Добавляем метку
  const markerElement = createMarkerElement(title || "Кружок")
  const marker = new YMapMarker({ coordinates: coords }, markerElement)
  map.addChild(marker)
}
