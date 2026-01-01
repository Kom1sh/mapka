'use client';
import { useRef } from 'react';
import Script from 'next/script';

const API_KEY = '58c38b72-57f7-4946-bc13-a256d341281a';

export default function ClubMap({ address, title }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const initMap = async () => {
    if (!window.ymaps3 || !mapRef.current) return;
    if (mapInstance.current) return;

    try {
      await window.ymaps3.ready;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;

      const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?format=json&apikey=${API_KEY}&geocode=${encodeURIComponent(address)}`;
      const res = await fetch(geocodeUrl);
      const data = await res.json();
      const pos = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
      if (!pos) return;

      const [lng, lat] = pos.split(' ').map(Number);

      mapInstance.current = new YMap(mapRef.current, { location: { center: [lng, lat], zoom: 16 } });
      mapInstance.current.addChild(new YMapDefaultSchemeLayer({}));
      mapInstance.current.addChild(new YMapDefaultFeaturesLayer({}));

      const el = document.createElement('div');
      el.className = 'club-marker';
      el.innerHTML = `<div class="club-marker-label">${title}</div><div class="club-marker-dot"></div>`;

      mapInstance.current.addChild(new YMapMarker({ coordinates: [lng, lat] }, el));
    } catch (e) {
      console.warn('Map init error:', e);
    }
  };

  return (
    <>
      <Script src={`https://api-maps.yandex.ru/v3/?apikey=${API_KEY}&lang=ru_RU`} onLoad={initMap} />
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="map-wrapper" id="clubMap" ref={mapRef}></div>
        <div style={{ padding: '16px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>Адрес:</div>
          <div style={{ color: '#555', fontSize: '15px' }}>{address}</div>
        </div>
      </div>
    </>
  );
}
