"use client";

import React, { useEffect, useMemo, useState } from "react";

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.detail) ? data.detail : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function slugifyRu(input) {
  const s = String(input || "").trim().toLowerCase();
  const map = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",
    к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
    х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return s
    .split("")
    .map((ch) => (map[ch] ?? ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const emptyForm = {
  id: "",
  name: "",
  slug: "",
  description: "",
  image: "",
  location: "",
  tagsText: "",
  price_rub: "",
  phone: "",
  webSite: "",
  socialLinksText: "{}",   // json
  schedulesText: "[]",     // json array of {day,time,note}
  lat: "",
  lon: "",
};

export default function AdminPanelClient() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [originalLocation, setOriginalLocation] = useState("");

  const selected = useMemo(
    () => clubs.find((c) => String(c.id) === String(selectedId)) || null,
    [clubs, selectedId]
  );

  async function loadClubs() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/clubs", { method: "GET" });
      setClubs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to load clubs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClubs(); }, []);

  function selectClub(c) {
    setSelectedId(c?.id || "");
    setOriginalLocation(c?.location || "");
    setForm({
      id: c?.id || "",
      name: c?.name || "",
      slug: c?.slug || "",
      description: c?.description || "",
      image: c?.image || "",
      location: c?.location || "",
      tagsText: Array.isArray(c?.tags) ? c.tags.join(", ") : "",
      price_rub: (c?.price_rub ?? "") === null ? "" : String(c?.price_rub ?? ""),
      phone: c?.phone || "",
      webSite: c?.webSite || "",
      socialLinksText: JSON.stringify(c?.socialLinks || {}, null, 2),
      schedulesText: JSON.stringify(c?.schedules || [], null, 2),
      lat: (c?.lat ?? "") === null ? "" : String(c?.lat ?? ""),
      lon: (c?.lon ?? "") === null ? "" : String(c?.lon ?? ""),
    });
  }

  function newClub() {
    setSelectedId("");
    setOriginalLocation("");
    setForm(emptyForm);
  }

  function buildPayload(currentForm) {
    const tags = String(currentForm.tagsText || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let socialLinks = {};
    try {
      socialLinks = currentForm.socialLinksText ? JSON.parse(currentForm.socialLinksText) : {};
      if (typeof socialLinks !== "object" || Array.isArray(socialLinks) || socialLinks === null) socialLinks = {};
    } catch {
      socialLinks = {};
    }

    let schedules = [];
    try {
      schedules = currentForm.schedulesText ? JSON.parse(currentForm.schedulesText) : [];
      if (!Array.isArray(schedules)) schedules = [];
    } catch {
      schedules = [];
    }

    const priceNum = String(currentForm.price_rub || "").trim();
    const price_rub = priceNum === "" ? null : Number(priceNum);

    const latStr = String(currentForm.lat || "").trim();
    const lonStr = String(currentForm.lon || "").trim();
    const lat = latStr === "" ? null : Number(latStr);
    const lon = lonStr === "" ? null : Number(lonStr);

    return {
      name: String(currentForm.name || "").trim(),
      slug: String(currentForm.slug || "").trim(),
      description: String(currentForm.description || "").trim(),
      image: String(currentForm.image || "").trim(),
      location: String(currentForm.location || "").trim(),
      tags,
      price_rub: Number.isFinite(price_rub) ? price_rub : null,
      phone: String(currentForm.phone || "").trim(),
      webSite: String(currentForm.webSite || "").trim(),
      socialLinks,
      schedules,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
    };
  }

  async function geocodeIfNeeded(payload) {
    // геокодим если адрес поменялся или coords пустые
    const locNow = String(payload.location || "").trim();
    if (!locNow) return payload;

    const locChanged = String(originalLocation || "").trim() !== locNow;
    const coordsMissing = payload.lat == null || payload.lon == null;

    if (!locChanged && !coordsMissing) return payload;

    // дергаем бек (он пробросит Referer к Яндексу)
    const geo = await apiFetch("/api/admin/geocode", {
      method: "POST",
      body: JSON.stringify({ location: locNow }),
    });

    if (geo && geo.lat != null && geo.lon != null) {
      return { ...payload, lat: geo.lat, lon: geo.lon };
    }
    // если не получилось — сохраняем без coords (но ты увидишь это и можешь поправить адрес)
    return payload;
  }

  async function saveClub() {
    setSaving(true);
    setError("");
    try {
      let payload = buildPayload(form);

      if (!payload.slug) {
        payload.slug = slugifyRu(payload.name) || payload.slug;
      }

      // ✅ геокодинг на сохранение
      payload = await geocodeIfNeeded(payload);

      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/clubs/${form.id}` : "/api/clubs";
      const method = isEdit ? "PUT" : "POST";

      const saved = await apiFetch(url, { method, body: JSON.stringify(payload) });

      // обновим список
      setClubs((prev) => {
        const arr = Array.isArray(prev) ? [...prev] : [];
        const idx = arr.findIndex((x) => String(x.id) === String(saved.id));
        if (idx >= 0) arr[idx] = saved;
        else arr.unshift(saved);
        return arr;
      });

      selectClub(saved);
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClub() {
    if (!form.id) return;
    if (!confirm("Удалить кружок?")) return;

    setSaving(true);
    setError("");
    try {
      await apiFetch(`/api/clubs/${form.id}`, { method: "DELETE" });
      setClubs((prev) => prev.filter((c) => String(c.id) !== String(form.id)));
      newClub();
    } catch (e) {
      setError(e.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function geocodeMissing() {
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch("/api/admin/geocode-missing?limit=200&sleep_ms=250", {
        method: "POST",
        body: JSON.stringify({}),
      });
      console.log("geocode-missing result:", result);
      await loadClubs();
    } catch (e) {
      setError(e.message || "Geocode missing failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      <aside style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={newClub} disabled={saving}>+ Новый</button>
          <button onClick={loadClubs} disabled={loading || saving}>Обновить</button>
        </div>
        <button onClick={geocodeMissing} disabled={saving} style={{ width: "100%", marginBottom: 12 }}>
          Геокодить пустые (lat/lon)
        </button>

        {loading ? <div>Загрузка…</div> : null}
        {error ? <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</div> : null}

        <div style={{ marginTop: 12, maxHeight: "70vh", overflow: "auto" }}>
          {clubs.map((c) => (
            <div
              key={c.id}
              onClick={() => selectClub(c)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid #eee",
                marginBottom: 8,
                cursor: "pointer",
                background: selectedId === c.id ? "#f5f7ff" : "white",
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{c.slug}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {c.lat != null && c.lon != null ? "✅ coords" : "⚠️ no coords"}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={saveClub} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          {form.id ? (
            <button onClick={deleteClub} disabled={saving} style={{ color: "crimson" }}>
              Удалить
            </button>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Название
            <input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((p) => ({ ...p, name, slug: p.slug ? p.slug : slugifyRu(name) }));
              }}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Slug
            <input
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Адрес (location)
            <input
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            lat
            <input
              value={form.lat}
              onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            lon
            <input
              value={form.lon}
              onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Описание
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              style={{ width: "100%", minHeight: 120 }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Image URL
            <input
              value={form.image}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Теги (через запятую)
            <input
              value={form.tagsText}
              onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Цена (руб)
            <input
              value={form.price_rub}
              onChange={(e) => setForm((p) => ({ ...p, price_rub: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Website
            <input
              value={form.webSite}
              onChange={(e) => setForm((p) => ({ ...p, webSite: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            socialLinks (JSON)
            <textarea
              value={form.socialLinksText}
              onChange={(e) => setForm((p) => ({ ...p, socialLinksText: e.target.value }))}
              style={{ width: "100%", minHeight: 120, fontFamily: "monospace" }}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            schedules (JSON array of {"{day,time,note}"})
            <textarea
              value={form.schedulesText}
              onChange={(e) => setForm((p) => ({ ...p, schedulesText: e.target.value }))}
              style={{ width: "100%", minHeight: 160, fontFamily: "monospace" }}
            />
          </label>
        </div>
      </main>
    </div>
  );
}
