"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ===============================
// Настройки
// ===============================
// Ключ Яндекс.Карт (JS API). Можно держать в фронте, но считай его публичным.
// Если в Яндексе стоит ограничение по HTTP Referer на mapka.рф —
// это НЕ защитит от полного злоупотребления (Referer можно подделать),
// но сильно снижает риск случайного слива ключа.
const YANDEX_MAPS_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a";

// Анти-бан: задержка между запросами геокодера при массовой обработке
const BATCH_SLEEP_MS = 250;

// ===============================
// Utils
// ===============================
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && data.detail) || (typeof data === "string" ? data : null) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNumOrEmpty(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim().replace(",", ".");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : "";
}

function normalizeTags(tagsLike) {
  if (Array.isArray(tagsLike)) return tagsLike;
  if (!tagsLike) return [];
  if (typeof tagsLike === "string") {
    return tagsLike
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

// ===============================
// Yandex Maps loader + geocode
// ===============================
let ymapsLoaderPromise = null;

function loadYmaps() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps доступен только в браузере"));
  }

  // уже загружено
  if (window.ymaps && typeof window.ymaps.ready === "function" && typeof window.ymaps.geocode === "function") {
    return new Promise((resolve) => window.ymaps.ready(resolve));
  }

  if (ymapsLoaderPromise) return ymapsLoaderPromise;

  ymapsLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-ymaps='2.1']");
    if (existing) {
      // ждём ready
      const wait = () => {
        if (window.ymaps && typeof window.ymaps.ready === "function") {
          window.ymaps.ready(resolve);
        } else {
          setTimeout(wait, 50);
        }
      };
      wait();
      return;
    }

    const script = document.createElement("script");
    script.dataset.ymaps = "2.1";
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(YANDEX_MAPS_API_KEY)}&lang=ru_RU`;

    script.onload = () => {
      try {
        if (!window.ymaps || typeof window.ymaps.ready !== "function") {
          reject(new Error("Yandex Maps скрипт загрузился, но ymaps не найден"));
          return;
        }
        window.ymaps.ready(resolve);
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error("Не удалось загрузить Yandex Maps JS API"));

    document.head.appendChild(script);
  });

  return ymapsLoaderPromise;
}

async function geocodeYandex(address) {
  const q = (address || "").trim();
  if (!q) return null;

  await loadYmaps();

  // ymaps.geocode возвращает Promise-like объект
  const res = await window.ymaps.geocode(q, { results: 1 });
  const first = res?.geoObjects?.get?.(0);
  if (!first) return null;

  const coords = first.geometry?.getCoordinates?.();
  if (!Array.isArray(coords) || coords.length < 2) return null;

  // В JS API 2.1 координаты приходят как [lat, lon]
  const lat = Number(coords[0]);
  const lon = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

// ===============================
// Component
// ===============================
export default function AdminPanelClient() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  const originalLocationRef = useRef("");
  const coordsTouchedRef = useRef(false);

  const emptyForm = useMemo(
    () => ({
      name: "",
      slug: "",
      description: "",
      image: "",
      location: "",
      lat: "",
      lon: "",
      tags: "",
      price_rub: "",
      phone: "",
      webSite: "",
      socialLinks: {},
      schedules: [],
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/clubs?limit=5000");
      setClubs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const selectedClub = useMemo(() => {
    if (!selectedId) return null;
    return clubs.find((c) => String(c.id) === String(selectedId)) || null;
  }, [clubs, selectedId]);

  function startNew() {
    setIsNew(true);
    setSelectedId(null);
    originalLocationRef.current = "";
    coordsTouchedRef.current = false;
    setForm(emptyForm);
  }

  function editClub(c) {
    setIsNew(false);
    setSelectedId(c.id);
    originalLocationRef.current = (c.location || "").trim();
    coordsTouchedRef.current = false;

    setForm({
      name: c.name || "",
      slug: c.slug || "",
      description: c.description || "",
      image: c.image || "",
      location: c.location || "",
      lat: toNumOrEmpty(c.lat),
      lon: toNumOrEmpty(c.lon),
      tags: Array.isArray(c.tags) ? c.tags.join(", ") : "",
      price_rub: c.price_rub != null ? String(c.price_rub) : "",
      phone: c.phone || "",
      webSite: c.webSite || "",
      socialLinks: c.socialLinks || {},
      schedules: Array.isArray(c.schedules) ? c.schedules : [],
    });
  }

  async function removeClub(c) {
    if (!c?.id) return;
    if (!confirm(`Удалить кружок: ${c.name}?`)) return;
    setSaving(true);
    setStatus("Удаляем...");
    try {
      await fetchJson(`/api/clubs/${c.id}`, { method: "DELETE" });
      await reload();
      setStatus("Удалено");
      if (String(selectedId) === String(c.id)) startNew();
    } catch (e) {
      setStatus("");
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function normalizePayload(curForm) {
    const tags = normalizeTags(curForm.tags);

    const payload = {
      name: (curForm.name || "").trim(),
      slug: (curForm.slug || "").trim(),
      description: curForm.description || "",
      image: (curForm.image || "").trim(),
      location: (curForm.location || "").trim(),
      tags,
      price_rub: curForm.price_rub !== "" ? Number(String(curForm.price_rub).replace(",", ".")) : null,
      phone: curForm.phone || "",
      webSite: curForm.webSite || "",
      socialLinks: typeof curForm.socialLinks === "object" && curForm.socialLinks ? curForm.socialLinks : {},
      schedules: Array.isArray(curForm.schedules) ? curForm.schedules : [],
    };

    const latN = Number(String(curForm.lat || "").replace(",", "."));
    const lonN = Number(String(curForm.lon || "").replace(",", "."));
    if (Number.isFinite(latN) && Number.isFinite(lonN)) {
      payload.lat = latN;
      payload.lon = lonN;
    }

    return payload;
  }

  async function ensureCoordsByLocation(payload, opts = { force: false }) {
    const loc = (payload.location || "").trim();
    if (!loc) return payload;

    const hasCoords = typeof payload.lat === "number" && typeof payload.lon === "number";

    const locationChanged = originalLocationRef.current !== "" && originalLocationRef.current !== loc;
    const need = opts.force || !hasCoords || (locationChanged && !coordsTouchedRef.current);

    if (!need) return payload;

    setStatus("Геокодим адрес через Яндекс...");
    const geo = await geocodeYandex(loc);
    if (!geo) {
      setStatus("Геокодинг не дал результата (сохранил без координат)");
      return payload;
    }

    // обновим форму, чтобы пользователь видел
    setForm((prev) => ({ ...prev, lat: String(geo.lat), lon: String(geo.lon) }));

    return { ...payload, lat: geo.lat, lon: geo.lon };
  }

  async function saveClub() {
    const payload0 = normalizePayload(form);

    if (!payload0.name) {
      alert("Название обязательно");
      return;
    }

    setSaving(true);
    setStatus("Сохраняем...");

    try {
      const payload = await ensureCoordsByLocation(payload0);

      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/clubs" : `/api/clubs/${selectedId}`;

      const saved = await fetchJson(url, {
        method,
        body: JSON.stringify(payload),
      });

      // обновим "оригинальный" адрес после сохранения
      originalLocationRef.current = (saved?.location || payload.location || "").trim();
      coordsTouchedRef.current = false;

      setStatus("Сохранено");
      await reload();

      // если был новый — открыть его
      if (isNew && saved?.id) {
        setIsNew(false);
        setSelectedId(saved.id);
      }
    } catch (e) {
      setStatus("");
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function geocodeCurrentAndApply({ saveNow }) {
    const loc = (form.location || "").trim();
    if (!loc) {
      alert("Сначала заполните адрес");
      return;
    }
    setSaving(true);
    try {
      setStatus("Геокодим адрес через Яндекс...");
      const geo = await geocodeYandex(loc);
      if (!geo) {
        setStatus("Геокодинг не дал результата");
        return;
      }

      coordsTouchedRef.current = true; // считаем, что пользователь явно захотел эти координаты
      setForm((p) => ({ ...p, lat: String(geo.lat), lon: String(geo.lon) }));

      if (saveNow && !isNew && selectedId) {
        setStatus("Сохраняем координаты...");
        await fetchJson(`/api/clubs/${selectedId}`, {
          method: "PUT",
          body: JSON.stringify({ lat: geo.lat, lon: geo.lon, location: loc }),
        });
        originalLocationRef.current = loc;
        coordsTouchedRef.current = false;
        setStatus("Координаты обновлены");
        await reload();
      } else {
        setStatus("Координаты проставлены в форме — нажмите «Сохранить»");
      }
    } catch (e) {
      setStatus("");
      alert(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function batchGeocode({ forceAll }) {
    if (batchRunning) return;

    const candidates = (clubs || []).filter((c) => {
      const loc = (c.location || "").trim();
      if (!loc) return false;
      if (forceAll) return true;
      return c.lat == null || c.lon == null;
    });

    if (!candidates.length) {
      alert(forceAll ? "Нет кружков для пересчёта (нет адресов)" : "Нет кружков без координат");
      return;
    }

    if (forceAll && !confirm(`Пересчитать координаты для ВСЕХ кружков (${candidates.length})? Это потратит лимит геокодера.`)) {
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: candidates.length, ok: 0, fail: 0 });
    setStatus(forceAll ? "Пересчитываем координаты для всех..." : "Заполняем координаты (пустые)...");

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      setBatchProgress((p) => ({ ...p, done: i, ok, fail }));

      try {
        const geo = await geocodeYandex(c.location);
        if (!geo) {
          fail++;
        } else {
          await fetchJson(`/api/clubs/${c.id}`, {
            method: "PUT",
            body: JSON.stringify({ lat: geo.lat, lon: geo.lon, location: (c.location || "").trim() }),
          });
          ok++;
        }
      } catch {
        fail++;
      }

      if (BATCH_SLEEP_MS) await sleep(BATCH_SLEEP_MS);
    }

    setBatchProgress({ done: candidates.length, total: candidates.length, ok, fail });
    setStatus(`Готово: ok=${ok}, fail=${fail}`);
    await reload();
    setBatchRunning(false);
  }

  // ===============================
  // UI
  // ===============================
  if (loading) {
    return <div style={{ padding: 16 }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={startNew} disabled={saving || batchRunning}>
            + Новый
          </button>
          <button onClick={() => batchGeocode({ forceAll: false })} disabled={saving || batchRunning}>
            Заполнить координаты
          </button>
          <button onClick={() => batchGeocode({ forceAll: true })} disabled={saving || batchRunning}>
            Коррекция (все)
          </button>
        </div>

        {batchRunning && (
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            Обработка: {batchProgress.done}/{batchProgress.total} • ok={batchProgress.ok} • fail={batchProgress.fail}
          </div>
        )}

        {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Подсказка: геокодинг делаем в браузере через JS API Яндекса, чтобы работал whitelist домена.
          Бэкенд только сохраняет lat/lon в БД.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "75vh", overflow: "auto" }}>
          {clubs.map((c) => {
            const active = String(c.id) === String(selectedId);
            const hasCoords = c.lat != null && c.lon != null;
            return (
              <div
                key={c.id}
                onClick={() => editClub(c)}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  cursor: "pointer",
                  background: active ? "#f5f7ff" : "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name || "(без названия)"}
                  </div>
                  <div title={hasCoords ? "Координаты есть" : "Координат нет"}>
                    {hasCoords ? "📍" : "⚠️"}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{c.location || ""}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                  lat: {c.lat ?? "—"} • lon: {c.lon ?? "—"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeClub(c);
                    }}
                    disabled={saving || batchRunning}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>{isNew ? "Новый кружок" : selectedClub ? `Редактирование: ${selectedClub.name}` : "Редактор"}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {!isNew && selectedId && (
              <button onClick={() => geocodeCurrentAndApply({ saveNow: true })} disabled={saving || batchRunning}>
                Коррекция геокоординат
              </button>
            )}
            <button onClick={saveClub} disabled={saving || batchRunning}>
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>
          </div>
        </div>

        {status && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{status}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Название
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Slug
            <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
            Описание
            <textarea
              value={form.description}
              rows={4}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Картинка (URL)
            <input value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Теги (через запятую)
            <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
            Адрес
            <input
              value={form.location}
              onChange={(e) => {
                const v = e.target.value;
                setForm((p) => ({ ...p, location: v, lat: "", lon: "" }));
                coordsTouchedRef.current = false;
              }}
              placeholder="просп. Королёва, 10/4, Ростов-на-Дону"
            />
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Если меняешь адрес — координаты очищаются и будут пересчитаны при сохранении.
            </div>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Широта (lat)
            <input
              value={form.lat}
              onChange={(e) => {
                coordsTouchedRef.current = true;
                setForm((p) => ({ ...p, lat: e.target.value }));
              }}
              placeholder="55.12345"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Долгота (lon)
            <input
              value={form.lon}
              onChange={(e) => {
                coordsTouchedRef.current = true;
                setForm((p) => ({ ...p, lon: e.target.value }));
              }}
              placeholder="39.12345"
            />
          </label>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button onClick={() => geocodeCurrentAndApply({ saveNow: false })} disabled={saving || batchRunning}>
              Геокодировать адрес (в форму)
            </button>
            {!isNew && selectedId && (
              <button onClick={() => geocodeCurrentAndApply({ saveNow: true })} disabled={saving || batchRunning}>
                Геокодировать и сохранить
              </button>
            )}
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Цена (руб)
            <input value={form.price_rub} onChange={(e) => setForm((p) => ({ ...p, price_rub: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Телефон
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Сайт
            <input value={form.webSite} onChange={(e) => setForm((p) => ({ ...p, webSite: e.target.value }))} />
          </label>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #eee", marginTop: 6, paddingTop: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Соц.сети (JSON)</div>
            <textarea
              rows={4}
              value={JSON.stringify(form.socialLinks || {}, null, 2)}
              onChange={(e) => {
                try {
                  const obj = JSON.parse(e.target.value || "{}") || {};
                  setForm((p) => ({ ...p, socialLinks: obj }));
                } catch {
                  // ignore parse errors while typing
                }
              }}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #eee", marginTop: 6, paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>Расписание</div>
              <button
                onClick={() => setForm((p) => ({ ...p, schedules: [...(p.schedules || []), { day: "", time: "", note: "" }] }))}
                disabled={saving || batchRunning}
              >
                + Добавить
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {(form.schedules || []).map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 180px 1fr 110px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    placeholder="День"
                    value={s.day || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        const next = [...(p.schedules || [])];
                        next[idx] = { ...next[idx], day: v };
                        return { ...p, schedules: next };
                      });
                    }}
                  />
                  <input
                    placeholder="Время"
                    value={s.time || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        const next = [...(p.schedules || [])];
                        next[idx] = { ...next[idx], time: v };
                        return { ...p, schedules: next };
                      });
                    }}
                  />
                  <input
                    placeholder="Примечание"
                    value={s.note || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        const next = [...(p.schedules || [])];
                        next[idx] = { ...next[idx], note: v };
                        return { ...p, schedules: next };
                      });
                    }}
                  />
                  <button
                    onClick={() =>
                      setForm((p) => {
                        const next = [...(p.schedules || [])];
                        next.splice(idx, 1);
                        return { ...p, schedules: next };
                      })
                    }
                    disabled={saving || batchRunning}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
