'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// ==================================
// Config
// ==================================
const YANDEX_JS_API_KEY =
  process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || '58c38b72-57f7-4946-bc13-a256d341281a';

const API_BASE = ''; // same-origin

const WEEKDAYS_RU = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
];

const SOCIAL_FIELDS = [
  { key: 'vk', label: 'VK' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
];
const SOCIAL_KEYS_SET = new Set(SOCIAL_FIELDS.map((x) => x.key));

// ==================================
// Small utils
// ==================================
function toastShow(setToast, msg) {
  setToast(msg);
  setTimeout(() => setToast(''), 2400);
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return Math.max(0, Math.round(n));
}

function normalizeAddr(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseTimeRange(timeStr) {
  const t = String(timeStr || '').trim();
  if (!t) return { start: '', end: '' };
  const cleaned = t.replace(/–|—/g, '-').replace(/\s+/g, '');
  // 10:00-22:00
  let m = cleaned.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (m) return { start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0') };
  // 10:00
  m = cleaned.match(/^(\d{1,2}:\d{2})$/);
  if (m) return { start: m[1].padStart(5, '0'), end: '' };
  return { start: '', end: '' };
}

function buildTimeString(start, end) {
  const s = String(start || '').trim();
  const e = String(end || '').trim();
  if (s && e) return `${s}-${e}`;
  if (s) return s;
  if (e) return e;
  return '';
}

function initScheduleRowsFromClub(club) {
  const base = WEEKDAYS_RU.map((d) => ({ day: d, enabled: false, start: '', end: '', note: '' }));
  const list = Array.isArray(club?.schedules) ? club.schedules : [];

  for (const item of list) {
    const dayRaw = String(item?.day || '').trim();
    const dayNorm = normalizeAddr(dayRaw);
    const idx = base.findIndex((x) => normalizeAddr(x.day) === dayNorm);
    if (idx === -1) continue;

    const { start, end } = parseTimeRange(item?.time);
    base[idx] = {
      ...base[idx],
      enabled: true,
      start,
      end,
      note: String(item?.note || ''),
    };
  }

  return base;
}

function schedulesToPayload(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.enabled) continue;
    const time = buildTimeString(r.start, r.end);
    const note = String(r.note || '').trim();
    if (!time && !note) continue;
    out.push({ day: r.day, time, note });
  }
  return out;
}

function initSocialFromClub(club) {
  const src = club?.socialLinks && typeof club.socialLinks === 'object' ? club.socialLinks : {};
  const links = {};
  const extras = [];

  for (const [k, v] of Object.entries(src)) {
    const key = String(k || '').trim();
    const val = String(v ?? '').trim();
    if (!key) continue;
    if (SOCIAL_KEYS_SET.has(key)) links[key] = val;
    else extras.push({ key, value: val });
  }

  // ensure known keys exist for nicer UI
  for (const f of SOCIAL_FIELDS) {
    if (!(f.key in links)) links[f.key] = '';
  }

  return { links, extras };
}

function buildSocialPayload(links, extras) {
  const out = {};
  const srcLinks = links && typeof links === 'object' ? links : {};
  for (const [k, v] of Object.entries(srcLinks)) {
    const key = String(k || '').trim();
    const val = String(v ?? '').trim();
    if (!key || !val) continue;
    out[key] = val;
  }
  for (const row of Array.isArray(extras) ? extras : []) {
    const key = String(row?.key || '').trim();
    const val = String(row?.value ?? '').trim();
    if (!key || !val) continue;
    out[key] = val;
  }
  return out;
}

async function loadYandexMapsScript() {
  if (typeof window === 'undefined') return;
  if (window.ymaps) return;

  const existing = document.getElementById('ymaps-script');
  if (existing) {
    await new Promise((resolve) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', resolve, { once: true });
    });
    return;
  }

  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.id = 'ymaps-script';
    s.async = true;
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(YANDEX_JS_API_KEY)}&lang=ru_RU`;
    s.onload = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

async function geocodeInBrowser(address) {
  const addr = String(address || '').trim();
  if (!addr) return null;

  await loadYandexMapsScript();
  if (!window.ymaps) return null;

  try {
    await window.ymaps.ready();
    const res = await window.ymaps.geocode(addr, { results: 1 });
    const geoObject = res?.geoObjects?.get(0);
    if (!geoObject) return null;

    const coords = geoObject.geometry.getCoordinates();
    // ymaps returns [lat, lon]
    const lat = Number(coords?.[0]);
    const lon = Number(coords?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// ==================================
// Component
// ==================================
export default function AdminPanelClient() {
  // inject a tiny fallback style set (на случай если css файл не подключился)
  useEffect(() => {
    const id = 'admin-panel-inline-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
:root{--accent:#2b87d4;--muted:#666;--danger:#d33}
.table{width:100%;border-collapse:collapse}
.table th,.table td{padding:8px;border-top:1px solid #eef1f3;font-size:13px;vertical-align:middle}
.table th{color:var(--muted);font-weight:600;text-align:left}
.timeRow{display:flex;align-items:center;gap:8px}
.timeRow input{width:140px}
.socialGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:980px){.socialGrid{grid-template-columns:1fr}}
.extraRow{display:flex;gap:8px;align-items:center}
.extraRow input.key{width:160px}
.btn.danger{background:var(--danger)}
`;
    document.head.appendChild(style);
  }, []);

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [log, setLog] = useState('');

  const selectedClub = useMemo(
    () => clubs.find((c) => String(c.id) === String(selectedId)) || null,
    [clubs, selectedId]
  );

  const [form, setForm] = useState(() => ({
    id: '',
    name: '',
    slug: '',
    description: '',
    image: '',
    location: '',
    lat: '',
    lon: '',
    tagsText: '',
    category: '',      // ✅ NEW
    minAge: '',        // ✅ NEW
    maxAge: '',        // ✅ NEW
    priceNotes: '',    // ✅ NEW
    price_rub: '',
    phone: '',
    webSite: '',
    socialLinks: Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, ''])),
    socialExtras: [],
    schedulesRows: WEEKDAYS_RU.map((d) => ({ day: d, enabled: false, start: '', end: '', note: '' })),
  }));

  const lastLocationRef = useRef('');

  // ----------------------------------
  // Fetch
  // ----------------------------------
  const fetchClubs = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/clubs?limit=5000`, { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setClubs(Array.isArray(data) ? data : []);
      if (!selectedId && Array.isArray(data) && data.length) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      console.error(e);
      toastShow(setToast, 'Не удалось загрузить список кружков');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------
  // When select club -> fill form
  // ----------------------------------
  useEffect(() => {
    if (!selectedClub) return;

    const { links, extras } = initSocialFromClub(selectedClub);
    const scheduleRows = initScheduleRowsFromClub(selectedClub);

    const next = {
      id: selectedClub.id || '',
      name: selectedClub.name || '',
      slug: selectedClub.slug || '',
      description: selectedClub.description || '',
      image: selectedClub.image || '',
      location: selectedClub.location || '',
      lat: selectedClub.lat ?? '',
      lon: selectedClub.lon ?? '',
      tagsText: Array.isArray(selectedClub.tags) ? selectedClub.tags.join(', ') : '',

      // ✅ NEW: category + age + price notes
      category: selectedClub.category ?? '',
      minAge: selectedClub.minAge ?? selectedClub.min_age ?? '',
      maxAge: selectedClub.maxAge ?? selectedClub.max_age ?? '',
      priceNotes: selectedClub.priceNotes ?? selectedClub.price_notes ?? '',

      price_rub:
        selectedClub.price_rub ??
        (selectedClub.price_cents != null ? (Number(selectedClub.price_cents) / 100).toFixed(2) : ''),
      phone: selectedClub.phone || '',
      webSite: selectedClub.webSite || selectedClub.website || '',
      socialLinks: links,
      socialExtras: extras,
      schedulesRows: scheduleRows,
    };

    lastLocationRef.current = String(next.location || '');
    setForm(next);
  }, [selectedClub]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => {
      const s = `${c.name || ''} ${c.slug || ''} ${c.location || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [clubs, search]);

  // ----------------------------------
  // Mutators
  // ----------------------------------
  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onLocationChange = (value) => {
    setForm((prev) => {
      const prevLoc = String(prev.location || '');
      const nextLoc = String(value || '');
      const changed = normalizeAddr(prevLoc) !== normalizeAddr(nextLoc);
      return {
        ...prev,
        location: nextLoc,
        // если адрес изменился — сбрасываем координаты, чтобы их пересчитать
        lat: changed ? '' : prev.lat,
        lon: changed ? '' : prev.lon,
      };
    });
  };

  const setSocialLink = (key, value) => {
    const k = String(key || '').trim();
    setForm((prev) => ({
      ...prev,
      socialLinks: {
        ...(prev.socialLinks || {}),
        [k]: value,
      },
    }));
  };

  const addSocialExtra = () => {
    setForm((prev) => ({
      ...prev,
      socialExtras: [...(prev.socialExtras || []), { key: '', value: '' }],
    }));
  };

  const setSocialExtra = (idx, patch) => {
    setForm((prev) => {
      const arr = [...(prev.socialExtras || [])];
      arr[idx] = { ...(arr[idx] || { key: '', value: '' }), ...patch };
      return { ...prev, socialExtras: arr };
    });
  };

  const removeSocialExtra = (idx) => {
    setForm((prev) => {
      const arr = [...(prev.socialExtras || [])];
      arr.splice(idx, 1);
      return { ...prev, socialExtras: arr };
    });
  };

  const setScheduleRow = (idx, patch) => {
    setForm((prev) => {
      const rows = [...(prev.schedulesRows || [])];
      rows[idx] = { ...(rows[idx] || {}), ...patch };
      // если выключили день — очищаем поля
      if (patch.enabled === false) {
        rows[idx].start = '';
        rows[idx].end = '';
        rows[idx].note = '';
      }
      return { ...prev, schedulesRows: rows };
    });
  };

  const quickCopyWeekdays = () => {
    setForm((prev) => {
      const rows = [...(prev.schedulesRows || [])];
      const mon = rows.find((r) => normalizeAddr(r.day) === 'понедельник');
      if (!mon?.enabled) return prev;
      for (const r of rows) {
        const d = normalizeAddr(r.day);
        if (['понедельник', 'вторник', 'среда', 'четверг', 'пятница'].includes(d) && r.enabled) {
          r.start = mon.start;
          r.end = mon.end;
        }
      }
      return { ...prev, schedulesRows: rows };
    });
    toastShow(setToast, 'Скопировал время с Пн на будни');
  };

  // ----------------------------------
  // Build payload
  // ----------------------------------
  function buildPayload(cur) {
    const price_rub_num = toNumberOrNull(cur.price_rub);
    const price_cents = price_rub_num != null ? Math.round(price_rub_num * 100) : null;

    const latNum = toNumberOrNull(cur.lat);
    const lonNum = toNumberOrNull(cur.lon);

    const tags = String(cur.tagsText || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const socialLinks = buildSocialPayload(cur.socialLinks, cur.socialExtras);
    const schedules = schedulesToPayload(cur.schedulesRows);

    // ✅ NEW fields
    const category = String(cur.category || '').trim();
    const minAge = toIntOrNull(cur.minAge);
    const maxAge = toIntOrNull(cur.maxAge);
    const priceNotes = String(cur.priceNotes || '').trim();

    return {
      name: String(cur.name || '').trim(),
      slug: String(cur.slug || '').trim(),
      description: String(cur.description || ''),
      image: String(cur.image || '').trim(),
      location: String(cur.location || '').trim(),
      ...(latNum != null && lonNum != null ? { lat: latNum, lon: lonNum } : {}),
      tags,
      isFavorite: false,

      // ✅ NEW fields for club page badges
      category: category || null,
      minAge,
      maxAge,
      priceNotes: priceNotes || null,

      price_rub: price_rub_num != null ? price_rub_num : null,
      price_cents,
      phone: String(cur.phone || '').trim(),
      webSite: String(cur.webSite || '').trim(),
      socialLinks,
      schedules,
    };
  }

  // ----------------------------------
  // CRUD
  // ----------------------------------
  const createNew = async () => {
    const slug = `club-${Math.random().toString(16).slice(2, 8)}`;
    const empty = {
      name: 'Новый кружок',
      slug,
      description: '',
      image: '',
      location: '',
      lat: '',
      lon: '',
      tagsText: '',
      category: '',
      minAge: '',
      maxAge: '',
      priceNotes: '',
      price_rub: '',
      phone: '',
      webSite: '',
      socialLinks: Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, ''])),
      socialExtras: [],
      schedulesRows: WEEKDAYS_RU.map((d) => ({ day: d, enabled: false, start: '', end: '', note: '' })),
    };

    try {
      const payload = buildPayload({ ...empty, name: empty.name, slug: empty.slug });
      const r = await fetch(`${API_BASE}/api/clubs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      const created = await r.json();
      toastShow(setToast, 'Создан');
      await fetchClubs();
      setSelectedId(created.id);
    } catch (e) {
      console.error(e);
      toastShow(setToast, 'Ошибка при создании');
    }
  };

  const saveForm = async () => {
    if (!selectedClub) return;

    const payload = buildPayload(form);

    // если адрес изменился и координат нет — автоматически геокодим (в браузере)
    const prevLoc = lastLocationRef.current;
    const nextLoc = String(form.location || '');
    const locationChanged = normalizeAddr(prevLoc) !== normalizeAddr(nextLoc);

    if ((payload.lat == null || payload.lon == null) && nextLoc) {
      if (locationChanged || selectedClub.lat == null || selectedClub.lon == null) {
        toastShow(setToast, 'Геокодим адрес…');
        const geo = await geocodeInBrowser(nextLoc);
        if (geo) {
          payload.lat = geo.lat;
          payload.lon = geo.lon;
          setForm((prev) => ({ ...prev, lat: String(geo.lat), lon: String(geo.lon) }));
        }
      }
    }

    try {
      const r = await fetch(`${API_BASE}/api/clubs/${encodeURIComponent(selectedClub.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      toastShow(setToast, 'Сохранено');

      lastLocationRef.current = String(updated.location || form.location || '');

      // update list without full reload
      setClubs((prev) => prev.map((c) => (String(c.id) === String(updated.id) ? updated : c)));
    } catch (e) {
      console.error(e);
      toastShow(setToast, 'Ошибка при сохранении');
    }
  };

  const deleteClub = async (clubId) => {
    if (!clubId) return;
    if (!confirm('Удалить кружок?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/clubs/${encodeURIComponent(clubId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error(await r.text());
      toastShow(setToast, 'Удалено');
      await fetchClubs();
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      toastShow(setToast, 'Ошибка при удалении');
    }
  };

  // ----------------------------------
  // Геокодинг кнопки (одного)
  // ----------------------------------
  const geocodeToForm = async () => {
    if (!form.location) {
      toastShow(setToast, 'Укажи адрес');
      return;
    }
    toastShow(setToast, 'Геокодим…');
    const geo = await geocodeInBrowser(form.location);
    if (!geo) {
      toastShow(setToast, 'Не удалось геокодировать');
      return;
    }
    setField('lat', String(geo.lat));
    setField('lon', String(geo.lon));
    toastShow(setToast, 'Координаты проставлены');
  };

  const geocodeAndSave = async () => {
    await geocodeToForm();
    await saveForm();
  };

  // ----------------------------------
  // Коррекция координат (по одному)
  // ----------------------------------
  const correctSelectedCoords = async () => {
    if (!selectedClub) return;
    if (!form.location) {
      toastShow(setToast, 'Адрес пустой');
      return;
    }
    toastShow(setToast, 'Корректируем…');
    const geo = await geocodeInBrowser(form.location);
    if (!geo) {
      toastShow(setToast, 'Не удалось геокодировать');
      return;
    }
    setForm((prev) => ({ ...prev, lat: String(geo.lat), lon: String(geo.lon) }));
    await saveForm();
  };

  // ----------------------------------
  // Bulk correction in browser
  // ----------------------------------
  const correctAllClientSide = async () => {
    if (!confirm('Прогнать коррекцию координат по всем кружкам?')) return;

    setLog('Старт коррекции…\n');
    await loadYandexMapsScript();
    if (!window.ymaps) {
      toastShow(setToast, 'Yandex Maps JS API не загрузился');
      return;
    }

    const list = [...clubs];
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const loc = String(c.location || '').trim();
      if (!loc) continue;

      const geo = await geocodeInBrowser(loc);
      if (!geo) {
        fail++;
        setLog((p) => p + `✗ ${c.slug || c.id}: geocode failed\n`);
        continue;
      }

      try {
        const r = await fetch(`${API_BASE}/api/clubs/${encodeURIComponent(c.id)}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: geo.lat, lon: geo.lon, location: loc }),
        });
        if (!r.ok) throw new Error(await r.text());
        const updated = await r.json();
        ok++;
        setClubs((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)));
        setLog((p) => p + `✓ ${updated.slug || updated.id}: ${geo.lat.toFixed(6)}, ${geo.lon.toFixed(6)}\n`);
      } catch (e) {
        fail++;
        setLog((p) => p + `✗ ${c.slug || c.id}: save failed\n`);
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 180));
    }

    toastShow(setToast, `Готово: ok=${ok}, fail=${fail}`);
  };

  // ----------------------------------
  // Bulk fill missing coords via backend util
  // ----------------------------------
  const fillMissingCoords = async () => {
    try {
      setLog('Запускаю /api/admin/geocode-missing…\n');
      const r = await fetch(`${API_BASE}/api/admin/geocode-missing?limit=200&sleep_ms=200`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      setLog((p) => p + JSON.stringify(data, null, 2) + '\n');
      await fetchClubs();
      toastShow(setToast, 'Готово');
    } catch (e) {
      console.error(e);
      toastShow(setToast, 'Ошибка');
    }
  };

  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <>
      <header>
        <h1>Mapka — Admin</h1>
        <div className="muted">
          Добавлены поля: Категория, Возраст (min/max), Примечание к цене.
        </div>
      </header>

      <div className="wrap">
        <aside className="left">
          <div className="toolbar">
            <button className="btn" onClick={createNew} disabled={loading}>
              + Новый
            </button>
            <button className="btn ghost" onClick={fillMissingCoords} title="Бэкенд-утилита (если нужно)">
              Заполнить координаты
            </button>
            <button className="btn ghost" onClick={correctAllClientSide} title="Коррекция координат всем (в браузере)">
              Коррекция (все)
            </button>
          </div>

          <div className="search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск…" />
          </div>

          <div className="list">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`item ${String(c.id) === String(selectedId) ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="meta">
                  <h4>{c.name || '—'}</h4>
                  <p>
                    {(c.location || '').slice(0, 80)}
                    {(c.location || '').length > 80 ? '…' : ''}
                  </p>
                  <p className="muted">
                    lat: {c.lat ?? '—'} • lon: {c.lon ?? '—'}
                  </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>📍</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="main">
          {!selectedClub ? (
            <div className="card">
              <div className="muted">Выбери кружок слева или создай новый.</div>
            </div>
          ) : (
            <div className="grid">
              <section className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Редактирование: {selectedClub.name}</h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn ghost" onClick={correctSelectedCoords}>
                      Коррекция геокоординат
                    </button>
                    <button className="btn" onClick={saveForm}>
                      Сохранить
                    </button>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label>Название</label>
                    <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                  </div>
                  <div style={{ width: 320 }}>
                    <label>Slug</label>
                    <input type="text" value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
                  </div>
                </div>

                {/* ✅ NEW: Category + Age */}
                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Категория (для бейджа на странице)</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                      placeholder="например: Спорт / Танцы / Робототехника"
                    />
                  </div>
                  <div style={{ width: 160 }}>
                    <label>Возраст от</label>
                    <input type="number" value={form.minAge} onChange={(e) => setField('minAge', e.target.value)} placeholder="7" />
                  </div>
                  <div style={{ width: 160 }}>
                    <label>Возраст до</label>
                    <input type="number" value={form.maxAge} onChange={(e) => setField('maxAge', e.target.value)} placeholder="12" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label>Описание</label>
                  <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} />
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Картинка (URL)</label>
                    <input type="text" value={form.image} onChange={(e) => setField('image', e.target.value)} />
                  </div>
                  <div style={{ width: 320 }}>
                    <label>Теги (через запятую)</label>
                    <input
                      type="text"
                      value={form.tagsText}
                      onChange={(e) => setField('tagsText', e.target.value)}
                      placeholder="спорт, музыка, танцы"
                    />
                    <div className="tags">
                      {String(form.tagsText || '')
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 12)
                        .map((t) => (
                          <span className="tag" key={t}>
                            {t}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label>Адрес</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => onLocationChange(e.target.value)}
                    placeholder="Улица, дом, Город"
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    Если меняешь адрес — координаты очищаются и будут пересчитаны при сохранении.
                  </div>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Широта (lat)</label>
                    <input type="text" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Долгота (lon)</label>
                    <input type="text" value={form.lon} onChange={(e) => setField('lon', e.target.value)} />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn ghost" onClick={geocodeToForm}>
                    Геокодировать адрес (в форму)
                  </button>
                  <button className="btn ghost" onClick={geocodeAndSave}>
                    Геокодировать и сохранить
                  </button>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Цена (руб)</label>
                    <input type="text" value={form.price_rub} onChange={(e) => setField('price_rub', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Примечание к цене</label>
                    <input
                      type="text"
                      value={form.priceNotes}
                      onChange={(e) => setField('priceNotes', e.target.value)}
                      placeholder='например: "за занятие" / "абонемент"'
                    />
                  </div>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label>Телефон</label>
                    <input type="text" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Сайт</label>
                    <input type="text" value={form.webSite} onChange={(e) => setField('webSite', e.target.value)} />
                  </div>
                </div>

                {/* Social links */}
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Соцсети</h3>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Вставляй полные ссылки (https://…). Пустые поля не сохраняются.
                  </div>

                  <div className="socialGrid" style={{ marginTop: 10 }}>
                    {SOCIAL_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label>{f.label}</label>
                        <input
                          type="text"
                          value={form.socialLinks?.[f.key] || ''}
                          onChange={(e) => setSocialLink(f.key, e.target.value)}
                          placeholder="https://…"
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="muted">Другие ссылки (если нужно)</div>
                    <button className="btn ghost" onClick={addSocialExtra}>
                      + Добавить
                    </button>
                  </div>

                  {Array.isArray(form.socialExtras) && form.socialExtras.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {form.socialExtras.map((row, idx) => (
                        <div key={idx} className="extraRow">
                          <input
                            className="key"
                            type="text"
                            value={row.key}
                            onChange={(e) => setSocialExtra(idx, { key: e.target.value })}
                            placeholder="ключ (например: ok)"
                          />
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => setSocialExtra(idx, { value: e.target.value })}
                            placeholder="https://…"
                          />
                          <button className="btn danger" onClick={() => removeSocialExtra(idx)} title="Удалить строку">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Schedules */}
                <div className="card" style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Расписание</h3>
                    <button className="btn ghost" onClick={quickCopyWeekdays} title="Копирует время с Понедельника на активные будни">
                      Скопировать Пн → будни
                    </button>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Отметь дни, выставь время и (опционально) примечание.
                  </div>

                  <div style={{ marginTop: 10, overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 190 }}>День</th>
                          <th style={{ width: 340 }}>Время</th>
                          <th>Примечание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.schedulesRows || []).map((r, idx) => (
                          <tr key={r.day}>
                            <td>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, color: '#111' }}>
                                <input
                                  type="checkbox"
                                  checked={!!r.enabled}
                                  onChange={(e) => setScheduleRow(idx, { enabled: e.target.checked })}
                                />
                                {r.day}
                              </label>
                            </td>
                            <td>
                              <div className="timeRow">
                                <input
                                  type="time"
                                  value={r.start}
                                  disabled={!r.enabled}
                                  onChange={(e) => setScheduleRow(idx, { start: e.target.value })}
                                />
                                <span className="muted">—</span>
                                <input
                                  type="time"
                                  value={r.end}
                                  disabled={!r.enabled}
                                  onChange={(e) => setScheduleRow(idx, { end: e.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={r.note}
                                disabled={!r.enabled}
                                onChange={(e) => setScheduleRow(idx, { note: e.target.value })}
                                placeholder="например: только по записи"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="actions" style={{ marginTop: 14 }}>
                  <button className="btn danger" onClick={() => deleteClub(selectedClub.id)}>
                    Удалить
                  </button>
                </div>
              </section>

              <aside className="card">
                <h3 style={{ margin: 0, fontSize: 16 }}>Логи</h3>
                <div className="muted" style={{ marginTop: 6 }}>
                  Тут видно, что сделала коррекция (все) и утилита заполнения.
                </div>
                <div className="muted-log" style={{ marginTop: 10, maxHeight: 420, overflow: 'auto' }}>
                  {log || '—'}
                </div>

                <div style={{ marginTop: 14 }} className="preview">
                  {form.image ? (
                    <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="muted">preview</div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
