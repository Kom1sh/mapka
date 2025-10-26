// js/map.js — fallback: создаём метки через ymaps3.YMapMarker (не нужен @yandex/ymaps3-default-ui-theme)
(async function initMap() {
  try { await ymaps3.ready; } catch (e) { console.error('ymaps3.ready failed', e); return; }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

  const rostovLocation = { center: [39.711515, 47.236171], zoom: 12 }; // [lng, lat]

  const map = new YMap(document.getElementById('map'), { location: rostovLocation });
  map.addChild(new YMapDefaultSchemeLayer());
  map.addChild(new YMapDefaultFeaturesLayer());

  // API-ключ для REST геокодера (тот же, что в index.html)
  const GEOCODE_API_KEY = '58c38b72-57f7-4946-bc13-a256d341281a';

  async function geocodeAddress(address) {
    if (!address) return null;
    const url = `https://geocode-maps.yandex.ru/1.x/?format=json&geocode=${encodeURIComponent(address)}&apikey=${GEOCODE_API_KEY}&results=1`;
    try {
      const r = await fetch(url);
      if (!r.ok) { console.warn('Geocode HTTP error', r.status); return null; }
      const json = await r.json();
      const fm = json?.response?.GeoObjectCollection?.featureMember;
      if (Array.isArray(fm) && fm.length) {
        const pos = fm[0].GeoObject?.Point?.pos; // "lng lat"
        if (pos) {
          const [lng, lat] = pos.split(' ').map(Number);
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) return [lng, lat];
        }
      }
      return null;
    } catch (err) {
      console.error('Fetch geocode failed', err);
      return null;
    }
  }

  // Создать DOM-элемент метки (иконка + подпись)
  function createMarkerElement(title = '') {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.cursor = 'pointer';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.gap = '4px';
    el.style.pointerEvents = 'auto'; // чтобы клики не блокировались
    // маленький круг-иконка
    const dot = document.createElement('div');
    dot.style.width = '18px';
    dot.style.height = '18px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#e74c3c';
    dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    // подпись
    const lbl = document.createElement('div');
    lbl.textContent = title;
    lbl.style.fontSize = '12px';
    lbl.style.whiteSpace = 'nowrap';
    lbl.style.background = 'rgba(255,255,255,0.9)';
    lbl.style.padding = '2px 6px';
    lbl.style.borderRadius = '8px';
    lbl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
    el.appendChild(dot);
    if (title) el.appendChild(lbl);
    return el;
  }

  function addMarkerToMap(coords, title = '') {
    try {
      // Второй аргумент — HTMLElement, который будет отрендерен как метка
      const marker = new YMapMarker({ coordinates: coords }, createMarkerElement(title));
      map.addChild(marker);
      return marker;
    } catch (err) {
      console.error('Ошибка при создании YMapMarker', err);
      return null;
    }
  }

  // Находим все .cardLocationText и геокодим их
  const els = Array.from(document.querySelectorAll('.cardLocationText'));
  if (!els.length) {
    console.warn('Не найдено .cardLocationText');
    return;
  }

  console.log('Найдено адресов:', els.length);
  const added = [];

  for (const el of els) {
    const raw = (el.textContent || '').trim();
    const address = raw.replace(/^г\.\s*/i, '').trim(); // убираем префикс "г."
    const title = el.closest('.sectionCard')?.querySelector('h2')?.textContent?.trim() || '';
    console.log('Геокодим:', raw, '=>', address);
    const coords = await geocodeAddress(address);
    if (coords) {
      console.log('Координаты:', coords);
      addMarkerToMap(coords, title);
      added.push(coords);
    } else {
      console.warn('Координаты не найдены для', address);
    }
    await new Promise(r => setTimeout(r, 200)); // пауза между запросами
  }

  // Центрируем карту по первой добавленной точке (если есть)
  if (added.length) {
    try {
      if (typeof map.setLocation === 'function') {
        map.setLocation({ center: added[0], zoom: 13 });
      } else {
        console.log('map.setLocation недоступен — оставляем исходный центр');
      }
    } catch (e) {
      console.warn('Не удалось центрировать карту', e);
    }
  } else {
    console.log('Маркеры не добавлены — оставляем исходный центр');
  }
})();
