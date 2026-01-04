"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Renders a single marker using stored coordinates (no client-side geocoding).
// Yandex Maps v3 expects coordinates as [lon, lat].

const DEFAULT_KEY = "58c38b72-57f7-4946-bc13-a256d341281a";

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default function ClubMap({ title, address, lat, lon, coords }) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [err, setErr] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || DEFAULT_KEY;

  const center = useMemo(() => {
    if (Array.isArray(coords) && coords.length === 2) {
      const c0 = toNum(coords[0]);
      const c1 = toNum(coords[1]);
      if (c0 != null && c1 != null) return [c0, c1];
    }
    const la = toNum(lat);
    const lo = toNum(lon);
    if (la == null || lo == null) return null;
    // IMPORTANT order: [lon, lat]
    return [lo, la];
  }, [coords, lat, lon]);

  useEffect(() => {
    let cancelled = false;

    async function ensureScript() {
      if (window.ymaps3) return;

      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-ymaps3="1"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Yandex Maps load failed")));
          return;
        }

        const s = document.createElement("script");
        s.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
        s.async = true;
        s.defer = true;
        s.dataset.ymaps3 = "1";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Yandex Maps load failed"));
        document.head.appendChild(s);
      });

      if (!window.ymaps3) throw new Error("ymaps3 is not available after script load");
      await window.ymaps3.ready;
    }

    async function init() {
      setErr("");

      // no coords => show placeholder, don’t init map
      if (!center) return;

      try {
        await ensureScript();
        if (cancelled) return;

        const ymaps3 = window.ymaps3;
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

        if (!wrapRef.current) return;

        // destroy previous if any
        if (mapRef.current) {
          try {
            mapRef.current.destroy();
          } catch {}
          mapRef.current = null;
          markerRef.current = null;
        }

        const map = new YMap(wrapRef.current, {
          location: { center, zoom: 16 },
        });

        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());

        const el = document.createElement("div");
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "999px";
        el.style.background = "#d11";
        el.style.boxShadow = "0 6px 18px rgba(0,0,0,.25)";
        el.title = title || address || "";

        const marker = new YMapMarker({ coordinates: center, draggable: false }, el);
        map.addChild(marker);

        mapRef.current = map;
        markerRef.current = marker;
      } catch (e) {
        console.error("[ClubMap] init error", e);
        setErr(String(e?.message || e));
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {}
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [apiKey, center, title, address]);

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          height: 320,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #e6e9ec",
          background: "#f0f2f4",
        }}
      />

      {!center ? (
        <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
          Координаты отсутствуют — добавь их в админке.
        </div>
      ) : null}

      {err ? (
        <div style={{ marginTop: 10, color: "#b00", fontSize: 13 }}>
          Ошибка карты: {err}
        </div>
      ) : null}
    </div>
  );
}
