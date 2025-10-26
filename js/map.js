// js/map.js
// Надёжный вариант: geocoding через REST + создание маркеров через ymaps3 UI-theme
(async function initMap() {
  try {
    await ymaps3.ready;
  } catch (e) {
    console.error('ymaps3.ready failed', e);
    return;
  }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps3;

  // --- Настройки карты ---
  const rostovLocation = {
    center: [39.711515, 47.236171], // [lng, lat]
    zoom: 12
  };

  const map = new YMap(document.getElementById('map'), { location: rostovLocation });
  map.addChild(new YMapDefaultSchemeLayer());
  map.addChild(new YMapDefaultFeaturesLayer());

  // --- Имя и ключ геокодера ---
  // Подставь сюда свой ключ, если он другой
  const GEOCODE_API_KEY = '58c38b72-57f7-4946-bc13-a256d341281a';

  // --- импорт маркера из UI-theme ---
  let YMapDefaultMarker;
  try {
    ({ YMapDefaultMarker } = await ymaps3.import('@yandex/ymaps3-default-ui-theme'));
  } catch (err) {
    console.error('Не удалось импортировать @yandex/ymaps3-default-ui-theme:', err);
    // продолжаем, но без UI-маркера — дальше попытаемся создать "простую" точку (но в большинстве случаев import нужен)
    return;
  }

  // --- helper: геокодинг через REST API Yandex ---
  async function geocodeAddress(address) {
    if (!address || !address.trim()) return null;
    const base = 'https://geocode-maps.yandex.ru/1.x/';
    const url = `${base}?format=json&geocode=${encodeURIComponent(address)}&apikey=${GEOCODE_API_KEY}&results=1`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Geocode fetch failed', res.status, res.statusText, url);
        return null;
      }
      const data = await res.json();
      const fm = data?.response?.GeoObjectCollection?.featureMember;
      if (Array.isArray(fm) && fm.length > 0) {
        const pos = fm[0].GeoObject?.Point?.pos; // "lng lat"
        if (pos) {
          const [lng, lat] = pos.split(' ').map(Number);
          if (!Number.isNaN(lng) && !Number.isNaN(lat)) return [lng, lat];
        }
      }
      return null;
    } catch (err) {
      console.error('Ошибка геокодинга (fetch):', err, address, url);
      return null;
    }
  }

  // --- Добавление маркера на карту ---
  function addMarker(coords, title = '', subtitle = '') {
    try {
      const marker = new YMapDefaultMarker({
        coordinates: coords,
        title: title || subtitle || '',
        subtitle: subtitle || '',
        size: 'normal'
      });
      map.addChild(marker);
      return marker;
    } catch (err) {
      console.error('Ошибка при создании маркера:', err, coords, title);
      return null;
    }
  }

  // --- Найти адреса на странице и обработать их ---
  const locationEls = Array.from(document.querySelectorAll('.cardLocationText'));
  if (!locationEls.length) {
    console.warn('Не найдено .cardLocationText на странице');
    return;
  }

  console.log('Найдено адресов для геокода:', locationEls.length);

  const addedCoords = [];
  for (const el of locationEls) {
    const raw = el.textContent.trim();
    // Приведём строку к более геокодируемому виду: уберём префикс "г." (иногда мешает)
    const address = raw.replace(/^г\.\s*/i, '').trim();
    const title = el.closest('.sectionCard')?.querySelector('h2')?.textContent?.trim() ?? '';
    console.log('Геокодим адрес:', raw, '->', address);
    const coords = await geocodeAddress(address);
    if (coords) {
      console.log('Результат геокода для', address, '=>', coords);
      addMarker(coords, title, address);
      addedCoords.push(coords);
    } else {
      console.warn('Не удалось найти координаты для адреса:', address);
    }
    // Небольшая пауза во избежание проблем с rate-limit
    await new Promise(r => setTimeout(r, 250));
  }

  // --- Центрирование карты по добавленным маркерам ---
  if (addedCoords.length) {
    // Возьмём первый маркер как центр, и немного увеличим зум если нужно
    try {
      const center = addedCoords[0];
      // Если API поддерживает setLocation — используем
      if (typeof map.setLocation === 'function') {
        map.setLocation({ center, zoom: 12 });
      } else {
        // fallback: найдём DOM-элемент карты и изменим атрибут (чаще setLocation доступен)
        console.log('map.setLocation недоступен, оставляем начальный центр');
      }
    } catch (err) {
      console.warn('Ошибка при попытке центрировать карту:', err);
    }
  } else {
    console.log('Маркеры не добавлены - оставляем исходный центр карты');
  }
})();
