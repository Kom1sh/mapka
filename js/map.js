// js/map.js — обновлённый: метки с видимыми подписями и кликом
(async function initMap() {
  try { await ymaps3.ready; } catch (e) { console.error('ymaps3.ready failed', e); return; }

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

  const rostovLocation = { center: [39.711515, 47.236171], zoom: 12 }; // [lng, lat]

  const map = new YMap(document.getElementById('map'), { location: rostovLocation });
  map.addChild(new YMapDefaultSchemeLayer());
  map.addChild(new YMapDefaultFeaturesLayer());

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
        const pos = fm[0].GeoObject?.Point?.pos;
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

  // Нормализует строку адреса для точного поиска карточки (убираем лишние пробелы и "г.")
  function normalizeAddress(str) {
    return (str || '').replace(/^г\.\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Создаём DOM-метку: точка + подпись
  function createMarkerElement(title = '', rawAddress = '') {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.position = 'relative';
    el.style.pointerEvents = 'auto';
    el.setAttribute('data-address', normalizeAddress(rawAddress));

    // точка (иконка)
    const dot = document.createElement('div');
    dot.className = 'custom-marker-dot';
    dot.style.width = '18px';
    dot.style.height = '18px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#e74c3c';
    dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)';
    dot.style.transform = 'translateY(0)';
    dot.style.zIndex = '2';

    // подпись
    const lbl = document.createElement('div');
    lbl.className = 'custom-marker-label';
    lbl.textContent = title || rawAddress || '';
    // базовые inline-стили — но лучше ещё добавить CSS ниже
    lbl.style.fontSize = '12px';
    lbl.style.color = '#111';
    lbl.style.background = 'rgba(255,255,255,0.95)';
    lbl.style.padding = '4px 8px';
    lbl.style.borderRadius = '10px';
    lbl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
    lbl.style.whiteSpace = 'nowrap';
    lbl.style.marginBottom = '6px';
    lbl.style.transform = 'translateY(-6px)';
    lbl.style.zIndex = '3';
    lbl.style.pointerEvents = 'none'; // чтобы клики шли на контейнер метки

    // упакуем: сначала подпись (над точкой), потом точка
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.appendChild(lbl);
    wrapper.appendChild(dot);

    el.appendChild(wrapper);

    return el;
  }

  function addMarkerToMap(coords, title = '', rawAddress = '') {
    try {
      const markerElement = createMarkerElement(title, rawAddress);
      const marker = new YMapMarker({ coordinates: coords }, markerElement);
      map.addChild(marker);

      // клик по метке -> найти карточку с таким адресом и скроллить к ней
      try {
        const elToMatch = markerElement.getAttribute('data-address');
        markerElement.addEventListener('click', () => {
          if (!elToMatch) return;
          const all = Array.from(document.querySelectorAll('.cardLocationText'));
          const target = all.find(x => normalizeAddress(x.textContent) === elToMatch);
          if (target) {
            target.closest('.sectionCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // можно также выделить карточку визуально
            const card = target.closest('.sectionCard');
            if (card) {
              card.classList.add('highlight-temp');
              setTimeout(() => card.classList.remove('highlight-temp'), 2000);
            }
          }
        });
      } catch (e) {
        console.warn('Не удалось повесить клик на метку', e);
      }

      return marker;
    } catch (err) {
      console.error('Ошибка при создании YMapMarker', err);
      return null;
    }
  }

  const els = Array.from(document.querySelectorAll('.cardLocationText'));
  if (!els.length) { console.warn('Не найдено .cardLocationText'); return; }
  console.log('Найдено адресов:', els.length);

  const added = [];
  for (const el of els) {
    const raw = el.textContent.trim();
    const address = raw.replace(/^г\.\s*/i, '').trim();
    const title = el.closest('.sectionCard')?.querySelector('h2')?.textContent?.trim() || '';
    console.log('Геокодим:', raw, '=>', address);
    const coords = await geocodeAddress(address);
    if (coords) {
      console.log('Координаты:', coords);
      addMarkerToMap(coords, title, address);
      added.push(coords);
    } else {
      console.warn('Координаты не найдены для', address);
    }
    await new Promise(r => setTimeout(r, 200));
  }

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
