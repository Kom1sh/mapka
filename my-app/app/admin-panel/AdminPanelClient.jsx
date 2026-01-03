"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Админ-панель (client)
 *
 * Ключевая логика:
 * - геокодинг делаем ТОЛЬКО в админке при сохранении (create/update) или вручную "Заполнить координаты".
 * - на публичных страницах карты используют lat/lon из БД и не жгут квоту.
 */

// По твоей просьбе — ключ прямо в коде (ограничивай по домену в Яндексе).
const YANDEX_GEOCODER_API_KEY = "58c38b72-57f7-4946-bc13-a256d341281a";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normAddr(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function safeJson(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

async function apiGet(url) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return safeJson(res);
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.detail || `POST ${url} -> ${res.status}`);
  return data;
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.detail || `PUT ${url} -> ${res.status}`);
  return data;
}

async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.detail || `DELETE ${url} -> ${res.status}`);
  return data;
}

async function geocodeYandex(address) {
  const addr = String(address || "").trim();
  if (!addr) return null;

  const params = new URLSearchParams({
    format: "json",
    apikey: YANDEX_GEOCODER_API_KEY,
    geocode: addr,
    results: "1",
  });
  const url = `https://geocode-maps.yandex.ru/1.x/?${params.toString()}`;

  // Важно: не ставим mode:no-cors — иначе не прочитать ответ.
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  // Яндекс иногда отвечает 200, но внутри может быть ошибка.
  const raw = await res.text();
  if (!res.ok) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const pos =
    data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
  if (!pos) return null;

  const [lonS, latS] = String(pos).split(" "); // yandex: "lon lat"
  const lat = Number(String(latS).replace(",", "."));
  const lon = Number(String(lonS).replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

const EMPTY_FORM = {
  id: null,
  name: "",
  slug: "",
  description: "",
  image: "",
  location: "",
  lat: "",
  lon: "",
  isFavorite: false,
  tagsText: "",
  price_rub: "",
  phone: "",
  webSite: "",
  socialLinks: { vk: "", telegram: "", instagram: "", youtube: "" },
  schedules: [{ day: "", time: "", note: "" }],
};

export default function AdminPanelClient() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [autoGeocode, setAutoGeocode] = useState(true);
  const [batchState, setBatchState] = useState(null); // {running, processed, updated, failed}

  const originalLocationRef = useRef("");
  const geocodeCacheRef = useRef(new Map()); // normAddr -> {lat,lon}

  const isEditing = !!form.id;

  const missingCoordsCount = useMemo(() => {
    return (clubs || []).filter((c) => c?.lat == null || c?.lon == null).length;
  }, [clubs]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet("/api/clubs?limit=5000&offset=0");
      setClubs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    originalLocationRef.current = "";
  }

  function handleEdit(c) {
    setError("");
    originalLocationRef.current = c?.location || "";
    setForm({
      id: c?.id || null,
      name: c?.name || "",
      slug: c?.slug || "",
      description: c?.description || "",
      image: c?.image || "",
      location: c?.location || "",
      lat: c?.lat != null ? String(c.lat) : "",
      lon: c?.lon != null ? String(c.lon) : "",
      isFavorite: !!c?.isFavorite,
      tagsText: Array.isArray(c?.tags) ? c.tags.join(", ") : "",
      price_rub:
        c?.price_rub != null && Number.isFinite(Number(c.price_rub))
          ? String(c.price_rub)
          : "",
      phone: c?.phone || "",
      webSite: c?.webSite || "",
      socialLinks: {
        vk: c?.socialLinks?.vk || "",
        telegram: c?.socialLinks?.telegram || "",
        instagram: c?.socialLinks?.instagram || "",
        youtube: c?.socialLinks?.youtube || "",
      },
      schedules:
        Array.isArray(c?.schedules) && c.schedules.length
          ? c.schedules.map((s) => ({
              day: s?.day || "",
              time: s?.time || "",
              note: s?.note || "",
            }))
          : [{ day: "", time: "", note: "" }],
    });
  }

  function parseTags(text) {
    return String(text || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function cleanSchedules(arr) {
    const src = Array.isArray(arr) ? arr : [];
    const out = src
      .map((s) => ({
        day: String(s?.day || "").trim(),
        time: String(s?.time || "").trim(),
        note: String(s?.note || "").trim(),
      }))
      .filter((s) => s.day || s.time || s.note);
    return out.length ? out : [];
  }

  function buildPayload(withCoords) {
    const price_rub_val = String(form.price_rub || "")
      .trim()
      .replace(",", ".");

    const price_rub = price_rub_val === "" ? null : Number(price_rub_val);

    const payload = {
      name: String(form.name || "").trim(),
      slug: String(form.slug || "").trim(),
      description: String(form.description || "").trim(),
      image: String(form.image || "").trim(),
      location: String(form.location || "").trim(),
      tags: parseTags(form.tagsText),
      isFavorite: !!form.isFavorite,
      price_rub: Number.isFinite(price_rub) ? price_rub : null,
      phone: String(form.phone || "").trim(),
      webSite: String(form.webSite || "").trim(),
      socialLinks: {
        vk: String(form.socialLinks?.vk || "").trim(),
        telegram: String(form.socialLinks?.telegram || "").trim(),
        instagram: String(form.socialLinks?.instagram || "").trim(),
        youtube: String(form.socialLinks?.youtube || "").trim(),
      },
      schedules: cleanSchedules(form.schedules),
    };

    // lat/lon — добавляем только если валидны
    if (withCoords && form.lat !== "" && form.lon !== "") {
      const lat = Number(String(form.lat).replace(",", "."));
      const lon = Number(String(form.lon).replace(",", "."));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.lat = lat;
        payload.lon = lon;
      }
    }

    return payload;
  }

  async function maybeGeocodeBeforeSave() {
    const loc = String(form.location || "").trim();
    if (!autoGeocode || !loc) return null;

    const prev = normAddr(originalLocationRef.current);
    const next = normAddr(loc);

    const locationChanged = next !== "" && next !== prev;
    const coordsMissing = !form.lat || !form.lon;

    if (!locationChanged && !coordsMissing) return null;

    const cacheKey = next;
    if (geocodeCacheRef.current.has(cacheKey)) {
      return geocodeCacheRef.current.get(cacheKey);
    }

    const geo = await geocodeYandex(loc);
    if (geo) {
      geocodeCacheRef.current.set(cacheKey, geo);
      setForm((p) => ({ ...p, lat: String(geo.lat), lon: String(geo.lon) }));
    }
    return geo;
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      if (!String(form.name || "").trim()) {
        throw new Error("name is required");
      }

      // 1) если адрес изменился или нет координат — геокодим на клиенте
      await maybeGeocodeBeforeSave();

      // 2) формируем payload (уже с lat/lon если они появились)
      const payload = buildPayload(true);

      // 3) сохраняем
      if (isEditing) {
        await apiPut(`/api/clubs/${form.id}`, payload);
      } else {
        await apiPost("/api/clubs", payload);
      }

      // 4) рефрешим список
      await refresh();
      resetForm();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!id) return;
    if (!confirm("Удалить кружок?")) return;
    setError("");
    try {
      await apiDelete(`/api/clubs/${id}`);
      await refresh();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  async function handleBatchGeocodeMissing() {
    if (!missingCoordsCount) return;
    if (!confirm(`Заполнить координаты для ${missingCoordsCount} кружков?`)) return;

    setBatchState({ running: true, processed: 0, updated: 0, failed: [] });
    setError("");

    const items = (clubs || []).filter((c) => c?.lat == null || c?.lon == null);
    let processed = 0;
    let updated = 0;
    const failed = [];

    for (const c of items) {
      processed += 1;
      setBatchState({ running: true, processed, updated, failed });

      const loc = String(c?.location || "").trim();
      if (!loc) {
        failed.push({ id: c?.id, slug: c?.slug, reason: "no location" });
        continue;
      }

      try {
        const geo = await geocodeYandex(loc);
        if (!geo) {
          failed.push({ id: c?.id, slug: c?.slug, reason: "geocode failed" });
          continue;
        }

        // ВАЖНО: отправляем только координаты — бэкенд их запишет в Club и (если есть) Address.
        await apiPut(`/api/clubs/${c.id}`, { lat: geo.lat, lon: geo.lon });
        updated += 1;
      } catch (e) {
        failed.push({ id: c?.id, slug: c?.slug, reason: e?.message || String(e) });
      }

      // небольшая пауза, чтобы не долбить геокодер
      await sleep(200);
    }

    setBatchState({ running: false, processed, updated, failed });
    await refresh();
  }

  function updateSchedule(idx, key, value) {
    setForm((p) => {
      const next = [...(p.schedules || [])];
      next[idx] = { ...(next[idx] || { day: "", time: "", note: "" }), [key]: value };
      return { ...p, schedules: next };
    });
  }

  function addScheduleRow() {
    setForm((p) => ({ ...p, schedules: [...(p.schedules || []), { day: "", time: "", note: "" }] }));
  }

  function removeScheduleRow(idx) {
    setForm((p) => {
      const next = [...(p.schedules || [])];
      next.splice(idx, 1);
      return { ...p, schedules: next.length ? next : [{ day: "", time: "", note: "" }] };
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Админ-панель</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* LEFT: list */}
        <div style={{ flex: 1, minWidth: 420 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button onClick={refresh} disabled={loading}>
              Обновить
            </button>
            <button onClick={resetForm} disabled={saving}>
              + Новый
            </button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>
                Без координат: <b>{missingCoordsCount}</b>
              </span>
              <button
                onClick={handleBatchGeocodeMissing}
                disabled={!missingCoordsCount || (batchState?.running ?? false)}
                title="Сделает геокодинг на клиенте и запишет lat/lon в БД"
              >
                Заполнить координаты
              </button>
            </div>
          </div>

          {batchState && (
            <div style={{ fontSize: 13, marginBottom: 10, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
              <div>
                Batch geocode: processed <b>{batchState.processed}</b>, updated <b>{batchState.updated}</b>, failed <b>{batchState.failed?.length || 0}</b>
                {batchState.running ? "…" : ""}
              </div>
              {batchState.failed?.length ? (
                <div style={{ marginTop: 6, maxHeight: 120, overflow: "auto", whiteSpace: "pre-wrap" }}>
                  {batchState.failed.slice(0, 10).map((f, i) => (
                    <div key={i}>• {f.slug || f.id}: {f.reason}</div>
                  ))}
                  {batchState.failed.length > 10 ? <div>…</div> : null}
                </div>
              ) : null}
            </div>
          )}

          {loading ? (
            <div>Загрузка…</div>
          ) : (
            <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f7f7f7" }}>
                    <th style={{ textAlign: "left", padding: 10 }}>Название</th>
                    <th style={{ textAlign: "left", padding: 10 }}>Slug</th>
                    <th style={{ textAlign: "left", padding: 10 }}>📍</th>
                    <th style={{ textAlign: "left", padding: 10 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(clubs || []).map((c) => {
                    const hasCoords = c?.lat != null && c?.lon != null;
                    return (
                      <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                        <td style={{ padding: 10 }}>
                          <button onClick={() => handleEdit(c)} style={{ background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }}>
                            {c.name || "(без названия)"}
                          </button>
                        </td>
                        <td style={{ padding: 10, opacity: 0.85 }}>{c.slug || ""}</td>
                        <td style={{ padding: 10 }}>{hasCoords ? "✅" : "—"}</td>
                        <td style={{ padding: 10, textAlign: "right" }}>
                          <button onClick={() => handleDelete(c.id)} style={{ color: "#b00020" }}>
                            Удалить
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: form */}
        <div style={{ flex: 1, minWidth: 420 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{isEditing ? "Редактирование" : "Новый кружок"}</h2>
              <label style={{ marginLeft: "auto", fontSize: 13, opacity: 0.9, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={autoGeocode} onChange={(e) => setAutoGeocode(e.target.checked)} />
                Авто-геокод при сохранении
              </label>
            </div>

            {error ? (
              <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "#ffecec", color: "#a40000" }}>{error}</div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Название *</span>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Slug</span>
                <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                <span>Описание</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                <span>Картинка (URL)</span>
                <input value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                <span>Адрес (location)</span>
                <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Lat</span>
                <input value={form.lat} onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))} placeholder="например 47.2357" />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Lon</span>
                <input value={form.lon} onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))} placeholder="например 39.7015" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Цена (₽)</span>
                <input value={form.price_rub} onChange={(e) => setForm((p) => ({ ...p, price_rub: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Телефон</span>
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Сайт</span>
                <input value={form.webSite} onChange={(e) => setForm((p) => ({ ...p, webSite: e.target.value }))} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Теги (через запятую)</span>
                <input value={form.tagsText} onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))} />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", gridColumn: "1 / -1" }}>
                <input type="checkbox" checked={!!form.isFavorite} onChange={(e) => setForm((p) => ({ ...p, isFavorite: e.target.checked }))} />
                <span>Избранное (isFavorite)</span>
              </label>
            </div>

            <div style={{ marginTop: 14 }}>
              <h3 style={{ margin: "10px 0 6px", fontSize: 16 }}>Соц.сети</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>VK</span>
                  <input
                    value={form.socialLinks.vk}
                    onChange={(e) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, vk: e.target.value } }))}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Telegram</span>
                  <input
                    value={form.socialLinks.telegram}
                    onChange={(e) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, telegram: e.target.value } }))}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Instagram</span>
                  <input
                    value={form.socialLinks.instagram}
                    onChange={(e) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, instagram: e.target.value } }))}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>YouTube</span>
                  <input
                    value={form.socialLinks.youtube}
                    onChange={(e) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, youtube: e.target.value } }))}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <h3 style={{ margin: "10px 0 6px", fontSize: 16 }}>Расписание</h3>
              {(form.schedules || []).map((s, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                  <input value={s.day} onChange={(e) => updateSchedule(idx, "day", e.target.value)} placeholder="День" />
                  <input value={s.time} onChange={(e) => updateSchedule(idx, "time", e.target.value)} placeholder="Время" />
                  <input value={s.note} onChange={(e) => updateSchedule(idx, "note", e.target.value)} placeholder="Комментарий" />
                  <button type="button" onClick={() => removeScheduleRow(idx)} title="Удалить строку">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={addScheduleRow}>
                + Добавить строку
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={handleSave} disabled={saving}>
                {saving ? "Сохраняю…" : "Сохранить"}
              </button>
              {isEditing ? (
                <button onClick={resetForm} disabled={saving}>
                  Отменить
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
