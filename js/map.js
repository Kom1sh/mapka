// js/map.js
async function initMap() {
  await ymaps3.ready;

  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps3;

  const rostovLocation = {
    center: [39.711515, 47.236171], // [lng, lat] — в ymaps3 используются [lng, lat]
    zoom: 12
  };

  // создаём карту
  const map = new YMap(
    document.getElementById('map'),
    { location: rostovLocation }
  );

  map.addChild(new YMapDefaultSchemeLayer());
  map.addChild(new YMapDefaultFeaturesLayer());

  // Импорт пакета маркеров (делаем один раз)
  let YMapDefaultMarker;
  try {
    ({ YMapDefaultMarker } = await ymaps3.import('@yandex/ymaps3-default-ui-theme'));
  } catch (err) {
    console.error('Не удалось импортировать пакет маркеров:', err);
    return;
  }

  // хелпер: геокодим адрес и добавляем маркер
  async function addMarkerForAddress(address, title = '') {
    if (!address || !address.trim()) return null;
    try {
      // forward geocoding через ymaps3.search
      const searchResults = await ymaps3.search({ text: address, results: 1 });
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const coords = searchResults[0].geometry.coordinates; // [lng, lat]
        const marker = new YMapDefaultMarker({
          coordinates: coords,
          title: title || address,
          subtitle: address,
          color: 'tulip',
          size: 'normal',
          iconName: 'fallback'
        });
        map.addChild(marker);
        return coords;
      } else {
        console.warn('Geocode: нет результатов для адреса:', address);
        return null;
      }
    } catch (err) {
      console.error('Ошибка при геокодинге адреса:', address, err);
      return null;
    }
  }

  // Найдём все карточки и поочерёдно добавим маркеры
  const locationEls = Array.from(document.querySelectorAll('.cardLocationText'));
  const addedCoords = [];
  for (const el of locationEls) {
    // берём текст адреса
    const address = el.textContent.trim();
    // берем title из ближайшей карточки (h2)
    const title = el.closest('.sectionCard')?.querySelector('h2')?.textContent?.trim() || '';
    const coords = await addMarkerForAddress(address, title);
    if (coords) addedCoords.push(coords);
    // маленькая пауза (опционально) чтобы не нагружать геосервер
    await new Promise(r => setTimeout(r, 250));
  }

  // (Опционально) если есть добавленные координаты — центрируем карту по первому
  if (addedCoords.length) {
    // Берём первый маркер и немного изменяем зум, если нужно
    map.setLocation?.({ center: addedCoords[0], zoom: 12 }); // setLocation может быть доступен в API
  }
}

initMap();
