'use client';

import { useEffect, useMemo, useRef } from 'react';
import Script from 'next/script';

const API_KEY =
  process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ||
  '58c38b72-57f7-4946-bc13-a256d341281a';

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Карта на странице кружка.
 * Важно: НЕТ геокодинга на клиенте — только координаты (lat/lon) из БД.
 * Порядок для Yandex Maps v3: [lon, lat]
 */
export default function ClubMap({ address, title = 'Адрес', lat, lon }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const last = useRef({ lat: null, lon: null });

  const latNum = useMemo(() => toNum(lat), [lat]);
  const lonNum = useMemo(() => toNum(lon), [lon]);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);

  const initOrUpdate = async () => {
    if (!hasCoords) return;
    if (!window.ymaps3 || !mapRef.current) return;

    // если координаты поменялись — пересоздадим карту (самый надёжный способ)
    const changed = last.current.lat !== latNum || last.current.lon !== lonNum;
    if (mapInstance.current && changed) {
      try {
        mapRef.current.innerHTML = '';
      } catch {}
      mapInstance.current = null;
    }
    if (mapInstance.current) return;

    await window.ymaps3.ready;

    const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

    const map = new YMap(mapRef.current, {
      location: { center: [lonNum, latNum], zoom: 16 },
    });

    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer());

    const pin = document.createElement('div');
    pin.style.width = '14px';
    pin.style.height = '14px';
    pin.style.borderRadius = '999px';
    pin.style.background = '#2b87d4';
    pin.style.border = '3px solid #fff';
    pin.style.boxShadow = '0 8px 22px rgba(0,0,0,.18)';
    pin.title = address || '';

    map.addChild(new YMapMarker({ coordinates: [lonNum, latNum] }, pin));

    mapInstance.current = map;
    last.current = { lat: latNum, lon: lonNum };
  };

  useEffect(() => {
    initOrUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latNum, lonNum, hasCoords]);

  useEffect(() => {
    return () => {
      try {
        if (mapRef.current) mapRef.current.innerHTML = '';
      } catch {}
      mapInstance.current = null;
    };
  }, []);

  return (
    <>
      <Script
        src={`https://api-maps.yandex.ru/v3/?apikey=${API_KEY}&lang=ru_RU`}
        strategy="afterInteractive"
        onLoad={initOrUpdate}
      />

      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="map-wrapper" id="clubMap" ref={mapRef} />

        <div style={{ padding: '16px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>
            {title}:
          </div>
          <div style={{ color: '#555', fontSize: '15px' }}>{address || '—'}</div>

          {!hasCoords ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
              Координаты не заполнены — зайди в админку и обнови геокоординаты для этого кружка.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
