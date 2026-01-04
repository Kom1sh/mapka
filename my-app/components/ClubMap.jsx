'use client';
import { useMemo, useRef } from 'react';
import Script from 'next/script';

// ВАЖНО:
// - Геокодинг на фронте больше не делаем (экономим лимит).
// - Координаты приходят с бэка: club.lat / club.lon (lat, lon).
const MAP_API_KEY = '58c38b72-57f7-4946-bc13-a256d341281a';

export default function ClubMap({ address, title, lat, lon, coords }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // coords ожидаем как [lng, lat] (если прокидываешь готовые)
  // либо lat/lon (как приходит из API)
  const point = useMemo(() => {
    if (Array.isArray(coords) && coords.length === 2) {
      const [lng, lt] = coords.map(Number);
      if (!Number.isNaN(lng) && !Number.isNaN(lt)) return [lng, lt];
    }
    if (lat != null && lon != null) {
      const lt = Number(lat);
      const lg = Number(lon);
      if (!Number.isNaN(lg) && !Number.isNaN(lt)) return [lg, lt];
    }
    return null;
  }, [coords, lat, lon]);

  const initMap = async () => {
    if (!window.ymaps3 || !mapRef.current) return;
    if (mapInstance.current) return;

    try {
      await window.ymaps3.ready;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

      // Ростов-на-Дону — дефолтный центр, если координат нет
      const fallbackCenter = [39.711515, 47.236171];
      const center = point || fallbackCenter;

      mapInstance.current = new YMap(mapRef.current, {
        location: { center, zoom: point ? 16 : 12 },
      });
      mapInstance.current.addChild(new YMapDefaultSchemeLayer({}));
      mapInstance.current.addChild(new YMapDefaultFeaturesLayer({}));

      if (point) {
        const safeTitle = (title || '').trim() || (address || '').trim() || 'Кружок';

        const el = document.createElement('div');
        el.className = 'club-marker';
        el.innerHTML = `<div class="club-marker-label">${safeTitle}</div><div class="club-marker-dot"></div>`;

        mapInstance.current.addChild(new YMapMarker({ coordinates: point }, el));
      }
    } catch (e) {
      console.warn('Map init error:', e);
    }
  };

  return (
    <>
      <Script src={`https://api-maps.yandex.ru/v3/?apikey=${MAP_API_KEY}&lang=ru_RU`} onLoad={initMap} />
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="map-wrapper" id="clubMap" ref={mapRef}></div>
        <div style={{ padding: '16px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>Адрес:</div>
          <div style={{ color: '#555', fontSize: '15px' }}>{address || '—'}</div>
        </div>
      </div>
    </>
  );
}
