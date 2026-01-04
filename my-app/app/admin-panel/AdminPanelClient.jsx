'use client';

import React, { useEffect, useMemo, useState } from 'react';

// Пользователь попросил прикрепить CSS прямо к компоненту.
// Инжектим стили в <head> один раз (и параллельно можно держать admin-panel.css).
const ADMIN_PANEL_CSS = String.raw`
:root{--accent:#2b87d4;--accent2:#1f6fb2;--muted:#667085;--bg:#f4f6f8;--card:#ffffff;--border:#e6e9ec;--shadow:0 10px 28px rgba(16,24,40,.08)}
*{box-sizing:border-box}
html,body{height:100%}
body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; margin:0;background:var(--bg);color:#111;overflow:hidden}

header{background:var(--card);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;gap:12px}
header h1{font-size:16px;margin:0;letter-spacing:.2px}

.wrap{display:flex;height:calc(100vh - 56px)}

.left{width:360px;background:var(--card);border-right:1px solid var(--border);overflow:auto;padding:12px;scrollbar-gutter:stable}
.left .toolbar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}

.btn{background:var(--accent);color:white;border:none;padding:8px 10px;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:transform .08s ease, background .16s ease, box-shadow .16s ease;box-shadow:0 6px 14px rgba(43,135,212,.14)}
.btn:hover{background:var(--accent2)}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--accent);border:1px solid rgba(43,135,212,.4);box-shadow:none}
.btn.ghost:hover{background:#eef6ff}

.list{display:flex;flex-direction:column;gap:10px}
.item{padding:12px;border-radius:14px;border:1px solid #eef1f4;background:#fbfcfe;cursor:pointer;display:flex;align-items:flex-start;gap:10px;transition:box-shadow .16s ease, border-color .16s ease, transform .16s ease}
.item:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(16,24,40,.06);border-color:rgba(43,135,212,.25)}
.item .meta{flex:1;min-width:0}
.item .meta h4{margin:0;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item .meta p{margin:6px 0 0;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.item.selected{box-shadow:0 14px 34px rgba(43,135,212,0.14);border-color:rgba(43,135,212,0.26);background:#f7fbff}
.pin{width:10px;height:10px;border-radius:999px;margin-top:4px;flex:0 0 auto;border:2px solid rgba(255,255,255,.8);box-shadow:0 6px 18px rgba(16,24,40,.18)}

.main{flex:1;padding:18px;overflow:auto;scrollbar-gutter:stable}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}
.card{background:var(--card);border-radius:16px;padding:14px;border:1px solid #eef1f4;box-shadow:0 8px 20px rgba(16,24,40,.05)}

label{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
input[type=text],input[type=number],textarea{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--border);font-size:14px;outline:none;transition:border-color .16s ease, box-shadow .16s ease;background:#fff}
input[type=text]:focus,input[type=number]:focus,textarea:focus{border-color:rgba(43,135,212,.55);box-shadow:0 0 0 4px rgba(43,135,212,.12)}
textarea{min-height:140px;resize:vertical}

.row{display:flex;gap:10px;flex-wrap:wrap}
.small{width:180px;max-width:100%}

.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.tag{background:#eef6ff;color:var(--accent);padding:6px 10px;border-radius:999px;font-size:12px;border:1px solid rgba(43,135,212,.18)}

.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.preview{border-radius:12px;overflow:hidden;border:1px solid var(--border);height:180px;background:#e9eef3;display:flex;align-items:center;justify-content:center}
.muted{color:var(--muted);font-size:13px;line-height:1.35}

.toast{position:fixed;right:18px;bottom:18px;background:#111;color:#fff;padding:10px 14px;border-radius:10px;opacity:0;transform:translateY(10px);transition:all .22s;z-index:50;max-width:520px}
.toast.show{opacity:1;transform:translateY(0)}

.search{display:flex;gap:8px;margin-bottom:10px}
.search input{flex:1;padding:10px 12px;border-radius:12px;border:1px solid var(--border)}

.muted-log{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-size:12px;color:#344054;line-height:1.35}

/* nice scrollbars (webkit) */
.left::-webkit-scrollbar,.main::-webkit-scrollbar{width:10px;height:10px}
.left::-webkit-scrollbar-thumb,.main::-webkit-scrollbar-thumb{background:rgba(16,24,40,.18);border-radius:999px;border:3px solid transparent;background-clip:padding-box}
.left::-webkit-scrollbar-track,.main::-webkit-scrollbar-track{background:transparent}

@media (max-width: 1100px){
  .wrap{height:auto;min-height:100vh}
  body{overflow:auto}
  .grid{grid-template-columns:1fr}
  .left{width:340px}
}
`;

function useEnsureAdminPanelCss() {
  useEffect(() => {
    const id = 'mapka-admin-panel-inline-css';
    if (typeof document === 'undefined') return;
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = ADMIN_PANEL_CSS;
    document.head.appendChild(style);
  }, []);
}

/**
 * AdminPanelClient
 * - Тянет /api/clubs
 * - Создание/редактирование/удаление
 * - Клиентский геокодинг через JS API (whitelist домена)
 * - Сохраняет lat/lon в БД (через PUT/POST)
 */

const isBrowser = typeof window !== 'undefined';

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function toastFactory(setToastMsg) {
  let t;
  return (msg) => {
    setToastMsg(msg);
    clearTimeout(t);
    t = setTimeout(() => setToastMsg(''), 2200);
  };
}

function normAddr(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getBaseApiUrl() {
  if (!isBrowser) return '';
  // если фронт и API на одном домене — оставляем "" и будем дергать относительные /api/...
  return '';
}

async function apiFetch(path, opts = {}) {
  const base = getBaseApiUrl();
  const res = await fetch(base + path, {
    credentials: 'include',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.detail ? JSON.stringify(j.detail) : JSON.stringify(j);
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = '';
      }
    }
    const err = new Error(`HTTP ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

/**
 * Подключение JS API Яндекса.
 * Важно: ключ должен быть разрешён по домену в кабинете.
 */
async function ensureYandexMapsLoaded(apiKey) {
  if (!isBrowser) return;
  if (window.ymaps && window.ymaps.ready) return;

  // уже грузится
  if (window.__YM_LOADING__) {
    await window.__YM_LOADING__;
    return;
  }

  window.__YM_LOADING__ = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    s.onload = () => {
      if (!window.ymaps || !window.ymaps.ready) {
        reject(new Error('Yandex Maps API loaded, but ymaps is unavailable'));
        return;
      }
      window.ymaps.ready(resolve);
    };
    s.onerror = () => reject(new Error('Failed to load Yandex Maps API script'));
    document.head.appendChild(s);
  });

  await window.__YM_LOADING__;
}

async function geocodeViaYmaps(address) {
  const addr = String(address || '').trim();
  if (!addr) return null;

  // cache in window (per session)
  const key = normAddr(addr);
  window.__GEOCODE_CACHE__ = window.__GEOCODE_CACHE__ || {};
  if (window.__GEOCODE_CACHE__[key]) return window.__GEOCODE_CACHE__[key];

  const res = await window.ymaps.geocode(addr, { results: 1 });
  const first = res.geoObjects.get(0);
  if (!first) return null;

  const coords = first.geometry.getCoordinates(); // [lat, lon]
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const out = { lat: coords[0], lon: coords[1] };
  window.__GEOCODE_CACHE__[key] = out;
  return out;
}

function buildPayload(form) {
  const priceRubNum = (() => {
    const v = String(form.price_rub ?? '').trim().replace(',', '.');
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  })();

  const socialLinks = safeJsonParse(form.socialLinksText || '{}', {});
  const schedules = safeJsonParse(form.schedulesText || '[]', []);
  const tags = String(form.tagsText || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // lat/lon: сервер ждёт lat/lon (float) или пусто
  const lat = String(form.lat ?? '').trim();
  const lon = String(form.lon ?? '').trim();

  return {
    name: String(form.name || '').trim(),
    slug: String(form.slug || '').trim(),
    description: String(form.description || '').trim(),
    image: String(form.image || '').trim(),
    location: String(form.location || '').trim(),
    ...(lat && lon ? { lat: Number(lat), lon: Number(lon) } : {}),
    tags,
    isFavorite: !!form.isFavorite,
    price_rub: priceRubNum,
    phone: String(form.phone || '').trim(),
    webSite: String(form.webSite || '').trim(),
    socialLinks,
    schedules,
  };
}

export default function AdminPanelClient() {
  useEnsureAdminPanelCss();
  // ВАЖНО: этот ключ подходит только если whitelist по домену настроен.
  // Если захочешь — вынесем в env NEXT_PUBLIC_YANDEX_MAPS_KEY.
  const YANDEX_JS_API_KEY = '58c38b72-57f7-4946-bc13-a256d341281a';

  const [clubs, setClubs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const toast = useMemo(() => toastFactory(setToastMsg), []);

  const [log, setLog] = useState('');
  const [form, setForm] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    image: '',
    location: '',
    lat: '',
    lon: '',
    tagsText: '',
    isFavorite: false,
    price_rub: '',
    phone: '',
    webSite: '',
    socialLinksText: '{}',
    schedulesText: '[]',
  });

  const selectedClub = useMemo(() => clubs.find((c) => c.id === selectedId) || null, [clubs, selectedId]);

  async function loadClubs() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/clubs');
      setClubs(Array.isArray(data) ? data : []);
      setLog((prev) => prev + `\n[OK] loaded clubs: ${Array.isArray(data) ? data.length : 0}`);

      // если выбранный пропал — сброс
      if (selectedId && Array.isArray(data) && !data.some((x) => x.id === selectedId)) {
        setSelectedId(null);
      }
    } catch (e) {
      console.error(e);
      setLog((prev) => prev + `\n[ERR] load clubs: ${e.message}`);
      toast('Ошибка загрузки /api/clubs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // при выборе клуба — заполнить форму
  useEffect(() => {
    if (!selectedClub) return;
    setForm({
      id: selectedClub.id,
      name: selectedClub.name || '',
      slug: selectedClub.slug || '',
      description: selectedClub.description || '',
      image: selectedClub.image || '',
      location: selectedClub.location || '',
      lat: selectedClub.lat != null ? String(selectedClub.lat) : '',
      lon: selectedClub.lon != null ? String(selectedClub.lon) : '',
      tagsText: Array.isArray(selectedClub.tags) ? selectedClub.tags.join(', ') : '',
      isFavorite: !!selectedClub.isFavorite,
      price_rub: selectedClub.price_rub != null ? String(selectedClub.price_rub) : '',
      phone: selectedClub.phone || '',
      webSite: selectedClub.webSite || '',
      socialLinksText: JSON.stringify(selectedClub.socialLinks || {}, null, 2),
      schedulesText: JSON.stringify(selectedClub.schedules || [], null, 2),
    });
  }, [selectedClub]);

  const filtered = useMemo(() => {
    const q = normAddr(search);
    if (!q) return clubs;
    return clubs.filter((c) => {
      const t = `${c?.name || ''} ${c?.slug || ''} ${c?.location || ''}`;
      return normAddr(t).includes(q);
    });
  }, [clubs, search]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function doSave({ forceGeocodeIfMissing = true } = {}) {
    if (!form.name.trim()) {
      toast('Название обязательно');
      return;
    }

    setLoading(true);
    try {
      let next = { ...form };

      // если адрес меняли — фронт обычно чистит lat/lon
      const hasCoords = String(next.lat || '').trim() && String(next.lon || '').trim();
      if (!hasCoords && forceGeocodeIfMissing && next.location.trim()) {
        setLog((p) => p + `\n[INFO] geocode (before save) for: ${next.location}`);
        await ensureYandexMapsLoaded(YANDEX_JS_API_KEY);
        const geo = await geocodeViaYmaps(next.location);
        if (geo) {
          next = { ...next, lat: String(geo.lat), lon: String(geo.lon) };
          setForm(next);
          setLog((p) => p + `\n[OK] geocode result: lat=${geo.lat} lon=${geo.lon}`);
        } else {
          setLog((p) => p + `\n[WARN] geocode returned null`);
        }
      }

      const payload = buildPayload(next);

      // create vs update
      let result;
      if (!next.id) {
        result = await apiFetch('/api/clubs', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        result = await apiFetch(`/api/clubs/${encodeURIComponent(next.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      }

      toast('Сохранено');
      setLog((p) => p + `\n[OK] saved club: ${result?.id || ''}`);
      await loadClubs();

      // после save — выделим сохранённый
      if (result?.id) setSelectedId(result.id);
    } catch (e) {
      console.error(e);
      toast('Ошибка сохранения');
      setLog((p) => p + `\n[ERR] save: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelected() {
    if (!selectedClub?.id) return;
    if (!confirm(`Удалить "${selectedClub.name}"?`)) return;

    setLoading(true);
    try {
      await apiFetch(`/api/clubs/${encodeURIComponent(selectedClub.id)}`, { method: 'DELETE' });
      toast('Удалено');
      setSelectedId(null);
      await loadClubs();
    } catch (e) {
      console.error(e);
      toast('Ошибка удаления');
      setLog((p) => p + `\n[ERR] delete: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function createNew() {
    setSelectedId(null);
    setForm({
      id: '',
      name: '',
      slug: '',
      description: '',
      image: '',
      location: '',
      lat: '',
      lon: '',
      tagsText: '',
      isFavorite: false,
      price_rub: '',
      phone: '',
      webSite: '',
      socialLinksText: '{\n  \"vk\": \"\",\n  \"telegram\": \"\"\n}',
      schedulesText: '[\n  {\n    \"day\": \"Понедельник\",\n    \"time\": \"09:00-21:00\",\n    \"note\": \"\"\n  }\n]',
    });
    toast('Новая карточка');
  }

  async function geocodeToFormOnly() {
    const addr = String(form.location || '').trim();
    if (!addr) {
      toast('Нет адреса');
      return;
    }
    setLoading(true);
    try {
      setLog((p) => p + `\n[INFO] geocode (to form): ${addr}`);
      await ensureYandexMapsLoaded(YANDEX_JS_API_KEY);
      const geo = await geocodeViaYmaps(addr);
      if (!geo) {
        toast('Геокодинг не дал результата');
        setLog((p) => p + `\n[WARN] geocode returned null`);
        return;
      }
      setField('lat', String(geo.lat));
      setField('lon', String(geo.lon));
      toast('Координаты проставлены в форму');
      setLog((p) => p + `\n[OK] geocode: lat=${geo.lat} lon=${geo.lon}`);
    } catch (e) {
      console.error(e);
      toast('Ошибка геокодинга');
      setLog((p) => p + `\n[ERR] geocode: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function geocodeAndSave() {
    await geocodeToFormOnly();
    // если координаты в форме появились — сохраняем
    const hasCoords = String(form.lat || '').trim() && String(form.lon || '').trim();
    if (hasCoords) {
      await doSave({ forceGeocodeIfMissing: false });
    }
  }

  async function fillMissingCoords() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/geocode-missing?limit=200&sleep_ms=200`, { method: 'POST' });
      setLog((p) => p + `\n[OK] backend backfill: processed=${res?.processed} updated=${res?.updated} failed=${res?.failed?.length || 0}`);
      toast(`Заполнено: ${res?.updated || 0}`);
      await loadClubs();
    } catch (e) {
      console.error(e);
      toast('Ошибка /api/admin/geocode-missing');
      setLog((p) => p + `\n[ERR] backend backfill: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function correctionAllClientSide() {
    // Клиентская коррекция: для всех клубов без координат — геокодим в браузере и сохраняем
    setLoading(true);
    let updated = 0;
    const failed = [];
    try {
      await ensureYandexMapsLoaded(YANDEX_JS_API_KEY);

      const list = [...clubs];
      for (const c of list) {
        const has = c?.lat != null && c?.lon != null;
        const loc = String(c?.location || '').trim();
        if (has || !loc) continue;

        const geo = await geocodeViaYmaps(loc);
        if (!geo) {
          failed.push({ id: c.id, slug: c.slug, location: loc });
          continue;
        }

        const payload = { location: loc, lat: geo.lat, lon: geo.lon };
        try {
          await apiFetch(`/api/clubs/${encodeURIComponent(c.id)}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          updated += 1;
        } catch (e) {
          failed.push({ id: c.id, slug: c.slug, location: loc, error: e.message });
        }

        // чтобы не спамить API
        await new Promise((r) => setTimeout(r, 180));
      }

      toast(`Коррекция: обновлено ${updated}`);
      setLog((p) => p + `\n[OK] client correction done: updated=${updated}, failed=${failed.length}`);
      if (failed.length) {
        setLog((p) => p + `\n[FAILED] ` + JSON.stringify(failed.slice(0, 10), null, 2));
      }
      await loadClubs();
    } catch (e) {
      console.error(e);
      toast('Ошибка клиентской коррекции');
      setLog((p) => p + `\n[ERR] client correction: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function onChangeLocation(v) {
    const prevLoc = String(form.location || '');
    setField('location', v);
    if (normAddr(prevLoc) !== normAddr(v)) {
      // адрес изменился — очищаем coords, чтобы пересчитались при сохранении
      setField('lat', '');
      setField('lon', '');
    }
  }

  return (
    <>
      <header>
        <h1>Mapka • Admin панель</h1>
        <button className="btn" onClick={createNew} disabled={loading}>
          + Новый
        </button>
        <button className="btn ghost" onClick={fillMissingCoords} disabled={loading}>
          Заполнить координаты
        </button>
        <button className="btn ghost" onClick={correctionAllClientSide} disabled={loading}>
          Коррекция (все)
        </button>
        <div style={{ marginLeft: 'auto' }} className="muted">
          {loading ? 'Загрузка…' : `Кружков: ${clubs.length}`}
        </div>
      </header>

      <div className="wrap">
        <aside className="left">
          <div className="search">
            <input
              type="text"
              placeholder="Поиск по названию / адресу / slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn ghost" onClick={loadClubs} disabled={loading} title="Обновить список">
              ↻
            </button>
          </div>

          <div className="list">
            {filtered.map((c) => {
              const missing = c?.lat == null || c?.lon == null;
              return (
                <div
                  key={c.id}
                  className={`item ${selectedId === c.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div className="pin" style={missing ? { background: 'rgba(227,77,77,.22)', borderColor: 'rgba(227,77,77,.7)' } : undefined} />
                  <div className="meta">
                    <h4>{c.name || '(без названия)'}</h4>
                    <p>
                      {c.location || ''}
                      <br />
                      <span className="muted">
                        lat: {c.lat ?? '—'} • lon: {c.lon ?? '—'}
                      </span>
                    </p>
                  </div>

                  <button
                    className="btn ghost"
                    style={{ padding: '6px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(c.id);
                      setTimeout(() => deleteSelected(), 0);
                    }}
                    title="Удалить"
                  >
                    Удалить
                  </button>
                </div>
              );
            })}

            {!filtered.length && <div className="muted">Ничего не найдено</div>}
          </div>
        </aside>

        <main className="main">
          {!selectedClub && (
            <div className="card">
              <h2 style={{ margin: 0 }}>Выбери кружок слева или нажми “+ Новый”.</h2>
              <p className="muted" style={{ marginTop: 10 }}>
                Подсказка: геокодинг делаем в браузере через JS API Яндекса, чтобы работал whitelist домена. Бэкенд
                только сохраняет lat/lon в БД.
              </p>
              <pre className="muted-log" style={{ marginTop: 12 }}>{log.trim()}</pre>
            </div>
          )}

          {selectedClub && (
            <div className="grid">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ margin: 0 }}>Редактирование: {selectedClub.name}</h2>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button className="btn ghost" onClick={geocodeAndSave} disabled={loading}>
                      Коррекция геокоординат
                    </button>
                    <button className="btn" onClick={() => doSave()} disabled={loading}>
                      Сохранить
                    </button>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label>Название</label>
                    <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                  </div>
                  <div style={{ width: 320 }}>
                    <label>Slug</label>
                    <input type="text" value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <label>Описание</label>
                <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} />

                <div style={{ height: 12 }} />

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label>Картинка (URL)</label>
                    <input type="text" value={form.image} onChange={(e) => setField('image', e.target.value)} />
                  </div>
                  <div style={{ width: 320 }}>
                    <label>Теги (через запятую)</label>
                    <input type="text" value={form.tagsText} onChange={(e) => setField('tagsText', e.target.value)} />
                    <div className="tags">
                      {String(form.tagsText || '')
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 8)
                        .map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <label>Адрес</label>
                <input type="text" value={form.location} onChange={(e) => onChangeLocation(e.target.value)} />
                <div className="muted" style={{ marginTop: 6 }}>
                  Если меняешь адрес — координаты очищаются и будут пересчитаны при сохранении.
                </div>

                <div style={{ height: 12 }} />

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label>Широта (lat)</label>
                    <input type="number" value={form.lat} onChange={(e) => setField('lat', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Долгота (lon)</label>
                    <input type="number" value={form.lon} onChange={(e) => setField('lon', e.target.value)} />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn ghost" onClick={geocodeToFormOnly} disabled={loading}>
                    Геокодировать адрес (в форму)
                  </button>
                  <button className="btn" onClick={geocodeAndSave} disabled={loading}>
                    Геокодировать и сохранить
                  </button>
                  <button className="btn ghost" onClick={deleteSelected} disabled={loading}>
                    Удалить
                  </button>
                </div>

                <div style={{ height: 12 }} />

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label>Цена (руб)</label>
                    <input type="number" value={form.price_rub} onChange={(e) => setField('price_rub', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Телефон</label>
                    <input type="text" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <label>Сайт</label>
                <input type="text" value={form.webSite} onChange={(e) => setField('webSite', e.target.value)} />

                <div style={{ height: 12 }} />

                <label>Соц.сети (JSON)</label>
                <textarea value={form.socialLinksText} onChange={(e) => setField('socialLinksText', e.target.value)} />

                <div style={{ height: 12 }} />

                <label>Расписание (JSON array)</label>
                <textarea value={form.schedulesText} onChange={(e) => setField('schedulesText', e.target.value)} />

                <div style={{ height: 12 }} />

                <label>Debug log</label>
                <pre className="muted-log">{log.trim()}</pre>
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Превью</h3>
                <div className="preview">
                  {form.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="muted">Нет картинки</span>
                  )}
                </div>

                <div style={{ height: 12 }} />

                <div className="card" style={{ border: '1px solid rgba(230,233,236,.95)' }}>
                  <div className="muted">ID</div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}>
                    {form.id || '—'}
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div className="muted">
                  <div>• Красный индикатор слева = нет координат</div>
                  <div>• “Заполнить координаты” — серверная миграция (если серверный геокод включён)</div>
                  <div>• “Коррекция (все)” — клиентский геокод в браузере с сохранением в БД</div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </>
  );
}
