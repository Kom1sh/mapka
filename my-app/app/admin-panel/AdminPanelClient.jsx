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

// ✅ TikTok убрали
const SOCIAL_FIELDS = [
  { key: 'vk', label: 'VK' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
];

// ✅ ключи, которые вообще не должны сохраняться
const IGNORED_SOCIAL_KEYS = new Set(['tiktok']);
const SOCIAL_KEYS_SET = new Set(SOCIAL_FIELDS.map((x) => x.key));

// ==================================
// Admin tabs + Blog config
// ==================================
const ADMIN_TABS = [
  { key: 'clubs', label: 'Кружки' },
  { key: 'blog', label: 'Блог' },
];

// Planned backend endpoints for blog posts.
// If backend does not have them yet, UI will fall back to localStorage.
const BLOG_API_LIST = '/api/blog/posts?limit=5000';
const BLOG_API_BASE = '/api/blog/posts';
const BLOG_STORAGE_KEY = 'mapka_admin_blog_posts_v1';

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

function normalizeFaqItems(input) {
  if (!input) return [];
  let data = input;

  // stringified JSON
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed);
    } catch {
      // allow simple text -> one item
      return [];
    }
  }

  // { items: [...] }
  if (data && !Array.isArray(data) && Array.isArray(data.items)) data = data.items;

  if (!Array.isArray(data)) return [];

  return data
    .map((x) => ({
      q: String(x?.q ?? x?.question ?? x?.title ?? ''),
      a: String(x?.a ?? x?.answer ?? x?.text ?? ''),
    }))
;
}

function normalizePricingItems(input) {
  if (!input) return [];

  let data = input;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  // allow shape { items: [...] }
  if (data && !Array.isArray(data) && Array.isArray(data.items)) data = data.items;

  if (!Array.isArray(data)) return [];

  return data
    .filter(Boolean)
    .map((x) => {
      const kind = String(x.kind ?? x.type ?? x.group ?? 'single').toLowerCase();
      const title = String(x.title ?? x.name ?? '');
      const badge = String(x.badge ?? '');
      const unit = String(x.unit ?? x.price_unit ?? x.priceUnit ?? '');
      const desc = String(x.desc ?? x.description ?? '');
      const details = String(x.details ?? x.more ?? x.more_details ?? x.moreDetails ?? '');

      const priceRaw = x.price_rub ?? x.priceRub ?? x.price ?? '';
      const price = priceRaw === null || priceRaw === undefined ? '' : String(priceRaw);
      const isFree = Boolean(x.isFree ?? x.free) || Number(priceRaw) == 0;

      return {
        kind: kind || 'single',
        title,
        badge,
        unit,
        price,
        isFree,
        desc,
        details,
      };
    });
}

// ---- blog helpers ----
const RU_TO_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function translitRuToLat(input) {
  const s = String(input || '');
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    if (low in RU_TO_LAT) {
      const t = RU_TO_LAT[low];
      out += ch === low ? t : t.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

function slugify(input) {
  const s = translitRuToLat(String(input || '')).toLowerCase();
  const slug = s
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return slug.slice(0, 80);
}


// Строгая нормализация slug при вводе (защита от мусора).
// Разрешаем только a-z, 0-9 и дефис. Во время набора не режем хвостовой дефис,
// чтобы не мешать пользователю печатать.
function sanitizeSlugTyped(input) {
  const s = translitRuToLat(String(input || '')).toLowerCase();
  return s
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .slice(0, 80);
}

function finalizeSlug(input) {
  return sanitizeSlugTyped(input).replace(/-+$/g, '');
}

function makeId(prefix = 'id') {
  // crypto.randomUUID is supported in modern browsers
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  } catch {}
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
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

    // ✅ TikTok и подобное игнорируем
    if (IGNORED_SOCIAL_KEYS.has(key)) continue;

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
    if (IGNORED_SOCIAL_KEYS.has(key)) continue; // ✅ не сохраняем
    out[key] = val;
  }

  for (const row of Array.isArray(extras) ? extras : []) {
    const key = String(row?.key || '').trim();
    const val = String(row?.value ?? '').trim();
    if (!key || !val) continue;
    if (IGNORED_SOCIAL_KEYS.has(key)) continue; // ✅ не сохраняем
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

  const [activeTab, setActiveTab] = useState('clubs');

  // Blog state (falls back to localStorage if backend endpoints are not ready yet)
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogSelectedId, setBlogSelectedId] = useState(null);
  const [blogSearch, setBlogSearch] = useState('');
  const [blogLog, setBlogLog] = useState('');

  const selectedPost = useMemo(
    () => blogPosts.find((p) => String(p.id) === String(blogSelectedId)) || null,
    [blogPosts, blogSelectedId]
  );

  const [postForm, setPostForm] = useState(() => ({
    id: '',
    title: '',
    slug: '',
    status: 'draft',
    excerpt: '',
    coverImage: '',
    tagsText: '',
    content: '',
    faq: [],
    createdAt: '',
    updatedAt: '',
    publishedAt: '',
  }));

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  // --- Blog: textarea editor helpers (mini-Word) ---
  // We keep storage format as HTML (string) to match blog rendering/ToC.
  const blogContentRef = useRef(null);
  const faqAnswerRefs = useRef([]);
  const pricingDescRefs = useRef([]);
  const pricingDetailsRefs = useRef([]);
  const clubDescRef = useRef(null);

  function getContentEl() {
    return blogContentRef.current;
  }

  function setContentValue(next) {
    setPostForm((p) => ({ ...p, content: next }));
  }

  function applyToSelection(transform) {
    const el = getContentEl();
    if (!el) return;

    const value = String(postForm.content || '');
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    const { text: replacement, selectFrom, selectTo } = transform({
      value,
      start,
      end,
      selected,
    });

    const next = value.slice(0, start) + replacement + value.slice(end);
    setContentValue(next);

    // Restore selection after React state update
    requestAnimationFrame(() => {
      try {
        el.focus();
        const s = typeof selectFrom === 'number' ? selectFrom : start;
        const e = typeof selectTo === 'number' ? selectTo : s;
        el.selectionStart = s;
        el.selectionEnd = e;
      } catch {
        // ignore
      }
    });
  }

  function wrapSelection(open, close, placeholder = '') {
    applyToSelection(({ selected }) => {
      const inner = selected || placeholder;
      const text = `${open}${inner}${close}`;
      const from = (blogContentRef.current?.selectionStart ?? 0) + open.length;
      const to = from + inner.length;
      return { text, selectFrom: from, selectTo: to };
    });
  }

  function insertAtCursor(text) {
    applyToSelection(({ start }) => {
      const from = start + text.length;
      return { text, selectFrom: from, selectTo: from };
    });
  }

  function normalizeAnchorId(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    // keep latin/cyrillic, digits, dash/underscore
    return s
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
      .slice(0, 64);
  }

  function editorAddHeading(level) {
    const tag = `h${level}`;
    applyToSelection(({ selected }) => {
      const title = selected || 'Заголовок';
      const open = `\n<${tag}>`;
      const close = `</${tag}>\n`;
      const text = `${open}${title}${close}`;
      const base = (blogContentRef.current?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + title.length };
    });
  }

  function editorAddLink() {
    const url = window.prompt('URL ссылки (например https://... или /club/slug):', '');
    if (!url) return;
    applyToSelection(({ selected }) => {
      const label = selected || window.prompt('Текст ссылки:', 'ссылка') || 'ссылка';
      const open = `<a href="${url}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = (blogContentRef.current?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }

  function editorInsertAnchor() {
    const id = normalizeAnchorId(window.prompt('ID якоря (латиница/цифры/дефис):', ''));
    if (!id) return;
    // Use <span id> to avoid invalid nesting
    insertAtCursor(`\n<span id="${id}"></span>\n`);
  }

  function editorLinkToAnchor() {
    const id = normalizeAnchorId(window.prompt('ID якоря (куда вести):', ''));
    if (!id) return;
    applyToSelection(({ selected }) => {
      const label = selected || window.prompt('Текст ссылки:', 'к разделу') || 'к разделу';
      const open = `<a href="#${id}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = (blogContentRef.current?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }



  // --- Clubs: mini-editor (как в блоге), хранение в HTML строке ---
  function getClubDescEl() {
    return clubDescRef.current;
  }

  function setClubDescValue(next) {
    setForm((prev) => ({ ...prev, descriptionHtml: next }));
  }

  function clubApplyToSelection(transform) {
    const el = getClubDescEl();
    if (!el) return;

    const value = String(form.descriptionHtml || '');
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    const { text: replacement, selectFrom, selectTo } = transform({ value, start, end, selected });
    const next = value.slice(0, start) + replacement + value.slice(end);
    setClubDescValue(next);

    requestAnimationFrame(() => {
      try {
        const el2 = getClubDescEl();
        if (!el2) return;
        el2.focus();
        const s = typeof selectFrom === 'number' ? selectFrom : start;
        const e = typeof selectTo === 'number' ? selectTo : s;
        el2.selectionStart = s;
        el2.selectionEnd = e;
      } catch {
        // ignore
      }
    });
  }

  function clubWrapSelection(open, close, placeholder = '') {
    clubApplyToSelection(({ selected }) => {
      const inner = selected || placeholder;
      const text = `${open}${inner}${close}`;
      const base = (getClubDescEl()?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + inner.length };
    });
  }

  function clubInsertAtCursor(text) {
    clubApplyToSelection(({ start, end }) => ({ text, selectFrom: start + text.length, selectTo: start + text.length }));
  }

  function clubAddHeading(level) {
    const tag = `h${level}`;
    clubApplyToSelection(({ selected, start }) => {
      const inner = selected || `Заголовок ${tag.toUpperCase()}`;
      const text = `
<${tag}>${inner}</${tag}>
`;
      const base = start + (`
<${tag}>`).length;
      return { text, selectFrom: base, selectTo: base + inner.length };
    });
  }

  function clubAddLink() {
    const url = window.prompt('URL ссылки (например https://... или /club/slug):', '');
    if (!url) return;
    clubApplyToSelection(({ selected, start }) => {
      const label = selected || window.prompt('Текст ссылки:', 'ссылка') || 'ссылка';
      const open = `<a href="${url}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = start + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }

  function clubInsertAnchor() {
    const id = normalizeAnchorId(window.prompt('ID якоря (латиница/цифры/дефис):', ''));
    if (!id) return;
    clubInsertAtCursor(`
<span id="${id}"></span>
`);
  }

  function clubLinkToAnchor() {
    const id = normalizeAnchorId(window.prompt('ID якоря (куда вести):', ''));
    if (!id) return;
    clubApplyToSelection(({ selected, start }) => {
      const label = selected || window.prompt('Текст ссылки:', 'к разделу') || 'к разделу';
      const open = `<a href="#${id}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = start + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }
  // --- FAQ: mini-formatting for answers (bold/italic/link) ---
  function getFaqAnswerEl(idx) {
    return (faqAnswerRefs.current && faqAnswerRefs.current[idx]) || null;
  }

  function applyToFaqSelection(idx, transform) {
    const el = getFaqAnswerEl(idx);
    if (!el) return;

    const list = normalizeFaqItems(postForm.faq);
    const value = String(list?.[idx]?.a ?? '');

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    const { text: replacement, selectFrom, selectTo } = transform({
      value,
      start,
      end,
      selected,
    });

    const next = value.slice(0, start) + replacement + value.slice(end);
    faqUpdate(idx, { a: next });

    requestAnimationFrame(() => {
      try {
        const el2 = getFaqAnswerEl(idx);
        if (!el2) return;
        el2.focus();
        const s = typeof selectFrom === 'number' ? selectFrom : start;
        const e = typeof selectTo === 'number' ? selectTo : s;
        el2.selectionStart = s;
        el2.selectionEnd = e;
      } catch {
        // ignore
      }
    });
  }

  function faqWrapSelection(idx, open, close, placeholder = '') {
    applyToFaqSelection(idx, ({ selected }) => {
      const inner = selected || placeholder;
      const text = `${open}${inner}${close}`;
      const base = (getFaqAnswerEl(idx)?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + inner.length };
    });
  }

  function faqInsertLink(idx) {
    const url = window.prompt('URL ссылки (например https://... или /club/slug):', '');
    if (!url) return;
    applyToFaqSelection(idx, ({ selected }) => {
      const label = selected || window.prompt('Текст ссылки:', 'ссылка') || 'ссылка';
      const open = `<a href="${url}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = (getFaqAnswerEl(idx)?.selectionStart ?? 0) + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }


  function getPricingDescEl(idx) {
    return (pricingDescRefs.current && pricingDescRefs.current[idx]) || null;
  }
  function getPricingDetailsEl(idx) {
    return (pricingDetailsRefs.current && pricingDetailsRefs.current[idx]) || null;
  }

  function applyToPricingField(idx, field, getEl, fn) {
    const el = getEl(idx);
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = String(el.value ?? '');
    const selected = value.slice(start, end);

    const res = fn({ value, selected, start, end });
    if (!res || typeof res.text !== 'string') return;

    const next = value.slice(0, start) + res.text + value.slice(end);
    setForm((prev) => {
      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
      const item = { ...(pricing[idx] || {}) };
      item[field] = next;
      pricing[idx] = item;
      return { ...prev, pricing };
    });

    requestAnimationFrame(() => {
      try {
        el.focus();
        if (typeof res.selectFrom === 'number' && typeof res.selectTo === 'number') {
          el.setSelectionRange(res.selectFrom, res.selectTo);
        }
      } catch {}
    });
  }

  function pricingDescWrap(idx, open, close, placeholder = '') {
    applyToPricingField(idx, 'desc', getPricingDescEl, ({ selected, start }) => {
      const inner = selected || placeholder;
      const text = `${open}${inner}${close}`;
      const base = (getPricingDescEl(idx)?.selectionStart ?? start) + open.length;
      return { text, selectFrom: base, selectTo: base + inner.length };
    });
  }

  function pricingDetailsWrap(idx, open, close, placeholder = '') {
    applyToPricingField(idx, 'details', getPricingDetailsEl, ({ selected, start }) => {
      const inner = selected || placeholder;
      const text = `${open}${inner}${close}`;
      const base = (getPricingDetailsEl(idx)?.selectionStart ?? start) + open.length;
      return { text, selectFrom: base, selectTo: base + inner.length };
    });
  }

  function pricingDescInsertLink(idx) {
    const url = window.prompt('URL ссылки (например https://... или /club/slug):', '');
    if (!url) return;
    applyToPricingField(idx, 'desc', getPricingDescEl, ({ selected, start }) => {
      const label = selected || window.prompt('Текст ссылки:', 'ссылка') || 'ссылка';
      const open = `<a href="${url}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = (getPricingDescEl(idx)?.selectionStart ?? start) + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }

  function pricingDetailsInsertLink(idx) {
    const url = window.prompt('URL ссылки (например https://... или /club/slug):', '');
    if (!url) return;
    applyToPricingField(idx, 'details', getPricingDetailsEl, ({ selected, start }) => {
      const label = selected || window.prompt('Текст ссылки:', 'ссылка') || 'ссылка';
      const open = `<a href="${url}">`;
      const close = `</a>`;
      const text = `${open}${label}${close}`;
      const base = (getPricingDetailsEl(idx)?.selectionStart ?? start) + open.length;
      return { text, selectFrom: base, selectTo: base + label.length };
    });
  }

  const [log, setLog] = useState('');

  const selectedClub = useMemo(
    () => clubs.find((c) => String(c.id) === String(selectedId)) || null,
    [clubs, selectedId]
  );

  const [form, setForm] = useState(() => ({
    id: '',
    name: '',
    slug: '',
    metaDescription: '',
    descriptionHtml: '',
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
    pricing: [],
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
      const r = await fetch(`/api/clubs?limit=5000`, { credentials: 'include' });
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
  // Blog: localStorage + API fallback
  // ----------------------------------
  const loadBlogLocal = () => {
    try {
      const raw = localStorage.getItem(BLOG_STORAGE_KEY);
      const arr = safeJsonParse(raw, []);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const saveBlogLocal = (list) => {
    try {
      localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(list || []));
    } catch {}
  };

  const normalizePostsFromApi = (data) => {
    // Accept: array OR {items:[...]} OR {data:[...]}
    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
    return arr
      .map((p) => ({
        id: p.id ?? p._id ?? makeId('post'),
        title: p.title ?? '',
        slug: p.slug ?? '',
        status: p.status ?? 'draft',
        excerpt: p.excerpt ?? p.description ?? '',
        coverImage: p.coverImage ?? p.cover_image ?? p.cover ?? '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        content: p.content ?? p.body ?? '',
        faq: normalizeFaqItems(p.faq ?? p.faq_items ?? null),
        createdAt: p.createdAt ?? p.created_at ?? '',
        updatedAt: p.updatedAt ?? p.updated_at ?? '',
        publishedAt: p.publishedAt ?? p.published_at ?? '',
      }))
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  };

  const fetchBlogPosts = async () => {
    setBlogLoading(true);
    try {
      const r = await fetch(BLOG_API_LIST, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        const list = normalizePostsFromApi(data);
        setBlogPosts(list);
        // keep local copy as cache
        saveBlogLocal(list);
        if (!blogSelectedId && list.length) setBlogSelectedId(list[0].id);
        return;
      }

      // fallback
      const local = loadBlogLocal();
      setBlogPosts(local);
      if (!blogSelectedId && local.length) setBlogSelectedId(local[0].id);
    } catch (e) {
      console.warn('fetchBlogPosts failed, fallback to localStorage', e);
      const local = loadBlogLocal();
      setBlogPosts(local);
      if (!blogSelectedId && local.length) setBlogSelectedId(local[0].id);
    } finally {
      setBlogLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'blog') return;
    fetchBlogPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // When select post -> fill form
  useEffect(() => {
    if (!selectedPost) return;
    setPostForm({
      id: selectedPost.id || '',
      title: selectedPost.title || '',
      slug: selectedPost.slug || '',
      status: selectedPost.status || 'draft',
      excerpt: selectedPost.excerpt || '',
      coverImage: selectedPost.coverImage || '',
      tagsText: Array.isArray(selectedPost.tags) ? selectedPost.tags.join(', ') : '',
      content: selectedPost.content || '',
      faq: normalizeFaqItems(selectedPost.faq),
      createdAt: selectedPost.createdAt || '',
      updatedAt: selectedPost.updatedAt || '',
      publishedAt: selectedPost.publishedAt || '',
    });
  }, [selectedPost]);

  const buildPostPayload = (cur) => {
    const title = String(cur.title || '').trim();
    const slugBase = finalizeSlug(String(cur.slug || '').trim()) || slugify(title);
    const slugFinal = slugBase || `post-${Math.random().toString(16).slice(2, 8)}`;

    const tags = String(cur.tagsText || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const status = cur.status === 'published' ? 'published' : 'draft';

    // if publishing and no date -> set now
    const publishedAt = status === 'published' ? (cur.publishedAt || new Date().toISOString()) : '';

    return {
      title,
      slug: slugFinal,
      status,
      excerpt: String(cur.excerpt || ''),
      content: String(cur.content || ''),
      faq: normalizeFaqItems(cur.faq)
      .map((x) => ({ q: String(x.q || '').trim(), a: String(x.a || '').trim() }))
      .filter((x) => x.q || x.a),
      cover_image: String(cur.coverImage || '').trim() || null,
      tags,
      published_at: publishedAt || null,
    };
  };

  // --- FAQ editor helpers (blog) ---
  const faqAdd = () => {
    setPostForm((p) => ({
      ...p,
      faq: [...normalizeFaqItems(p.faq), { q: '', a: '' }],
    }));
  };

  const faqUpdate = (index, patch) => {
    setPostForm((p) => {
      const list = [...normalizeFaqItems(p.faq)];
      list[index] = { ...(list[index] || { q: '', a: '' }), ...patch };
      return { ...p, faq: list };
    });
  };

  const faqRemove = (index) => {
    setPostForm((p) => {
      const list = [...normalizeFaqItems(p.faq)];
      list.splice(index, 1);
      return { ...p, faq: list };
    });
  };

  const faqMove = (index, dir) => {
    setPostForm((p) => {
      const list = [...normalizeFaqItems(p.faq)];
      const next = index + dir;
      if (next < 0 || next >= list.length) return p;
      const tmp = list[index];
      list[index] = list[next];
      list[next] = tmp;
      return { ...p, faq: list };
    });
  };

  const createNewPost = async () => {
    const id = makeId('post');
    const now = new Date().toISOString();
    const base = {
      id,
      title: 'Новая статья',
      slug: `post-${Math.random().toString(16).slice(2, 8)}`,
      status: 'draft',
      excerpt: '',
      coverImage: '',
      tags: [],
      content: '',
      faq: [],
      createdAt: now,
      updatedAt: now,
      publishedAt: '',
    };

    try {
      const r = await fetch(BLOG_API_BASE, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPostPayload(base)),
      });
      if (r.ok) {
        const created = normalizePostsFromApi([await r.json()])[0];
        setBlogPosts((prev) => {
          const next = [created, ...(prev || [])];
          saveBlogLocal(next);
          return next;
        });
        setBlogSelectedId(created.id);
        toastShow(setToast, 'Статья создана');
        return;
      }
    } catch {}

    // local fallback
    setBlogPosts((prev) => {
      const next = [base, ...(prev || [])];
      saveBlogLocal(next);
      return next;
    });
    setBlogSelectedId(id);
    setPostForm({
      id,
      title: base.title,
      slug: base.slug,
      status: base.status,
      excerpt: base.excerpt,
      coverImage: base.coverImage,
      tagsText: '',
      content: base.content,
      faq: base.faq,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
      publishedAt: base.publishedAt,
    });
    toastShow(setToast, 'Статья создана (локально)');
  };

  const savePost = async () => {
    if (!selectedPost) return;
    const payload = buildPostPayload(postForm);

    try {
      const r = await fetch(`${BLOG_API_BASE}/${encodeURIComponent(selectedPost.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const updated = normalizePostsFromApi([await r.json()])[0];
        setBlogPosts((prev) => {
          const next = (prev || []).map((p) => (String(p.id) === String(updated.id) ? updated : p));
          saveBlogLocal(next);
          return next;
        });
        toastShow(setToast, 'Сохранено');
        return;
      }
    } catch {}

    // local fallback
    const now = new Date().toISOString();
    const localUpdated = {
      ...selectedPost,
      title: payload.title,
      slug: payload.slug,
      status: payload.status,
      excerpt: payload.excerpt,
      content: payload.content,
      faq: Array.isArray(payload.faq) ? payload.faq : normalizeFaqItems(payload.faq),
      coverImage: payload.cover_image || '',
      tags: payload.tags || [],
      publishedAt: payload.published_at || '',
      updatedAt: now,
    };

    setBlogPosts((prev) => {
      const next = (prev || []).map((p) => (String(p.id) === String(selectedPost.id) ? localUpdated : p));
      saveBlogLocal(next);
      return next;
    });
    setBlogLog((p) => p + `✓ save(local): ${payload.slug}
`);
    toastShow(setToast, 'Сохранено (локально)');
  };

  const deletePost = async (postId) => {
    if (!postId) return;
    if (!confirm('Удалить статью?')) return;

    try {
      const r = await fetch(`${BLOG_API_BASE}/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (r.ok) {
        setBlogPosts((prev) => {
          const next = (prev || []).filter((p) => String(p.id) !== String(postId));
          saveBlogLocal(next);
          return next;
        });
        setBlogSelectedId(null);
        toastShow(setToast, 'Удалено');
        return;
      }
    } catch {}

    // local fallback
    setBlogPosts((prev) => {
      const next = (prev || []).filter((p) => String(p.id) !== String(postId));
      saveBlogLocal(next);
      return next;
    });
    setBlogSelectedId(null);
    toastShow(setToast, 'Удалено (локально)');
  };

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
      metaDescription: selectedClub.meta_description || selectedClub.metaDescription || '',
      descriptionHtml: selectedClub.description || '',
      image: selectedClub.image || '',
      location: selectedClub.location || '',
      lat: selectedClub.lat ?? '',
      lon: selectedClub.lon ?? '',
      tagsText: Array.isArray(selectedClub.tags) ? selectedClub.tags.join(', ') : '',
      category: selectedClub.category ?? '',
      minAge: selectedClub.minAge ?? selectedClub.min_age ?? '',
      maxAge: selectedClub.maxAge ?? selectedClub.max_age ?? '',
      priceNotes: selectedClub.priceNotes ?? selectedClub.price_notes ?? '',
      price_rub:
        selectedClub.price_rub ??
        (selectedClub.price_cents != null ? (Number(selectedClub.price_cents) / 100).toFixed(2) : ''),
      pricing: normalizePricingItems(selectedClub.pricing),
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

  const filteredPosts = useMemo(() => {
    const q = blogSearch.trim().toLowerCase();
    if (!q) return blogPosts;
    return (blogPosts || []).filter((p) => {
      const s = `${p.title || ''} ${p.slug || ''} ${p.excerpt || ''}`.toLowerCase();
      return s.includes(q);
    });
  }, [blogPosts, blogSearch]);


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

    const category = String(cur.category || '').trim();
    const minAge = toIntOrNull(cur.minAge);
    const maxAge = toIntOrNull(cur.maxAge);
    const priceNotes = String(cur.priceNotes || '').trim();
    const pricingRaw = normalizePricingItems(cur.pricing);

    const parsePrice = (v) => {
      const txt = String(v ?? '').trim().replace(',', '.');
      if (!txt) return null;
      const n = Number(txt);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.round(n));
    };

    const pricingPayloadArr = pricingRaw
      .map((it) => {
        const title = String(it.title || '').trim();
        const kind = String(it.kind || 'single').trim().toLowerCase();
        const badge = String(it.badge || '').trim();
        const unit = String(it.unit || '').trim();
        const desc = String(it.desc || '');
        const details = String(it.details || '');

        const priceNum = parsePrice(it.price);
        const isFree = Boolean(it.isFree) || priceNum == 0;

        return {
          kind: kind || 'single',
          title,
          badge: badge || null,
          unit: unit || null,
          price_rub: isFree ? 0 : priceNum,
          desc: desc || null,
          details: details || null,
        };
      })
      .filter((x) => x.title || x.price_rub != null || x.desc || x.details);

    const pricingPayload = pricingPayloadArr.length ? pricingPayloadArr : null;


    return {
      name: String(cur.name || '').trim(),
      slug: finalizeSlug(String(cur.slug || '').trim()) || slugify(String(cur.name || '').trim()) || `club-${Math.random().toString(16).slice(2, 8)}`,
      description: String(cur.descriptionHtml || ''),
      ...(String(cur.metaDescription || '').trim() ? { meta_description: String(cur.metaDescription || '').trim() } : {}),
      image: String(cur.image || '').trim(),
      location: String(cur.location || '').trim(),
      ...(latNum != null && lonNum != null ? { lat: latNum, lon: lonNum } : {}),
      tags,
      isFavorite: false,

      category: category || null,
      minAge,
      maxAge,
      priceNotes: priceNotes || null,
      pricing: pricingPayload,

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
      metaDescription: '',
      descriptionHtml: '',
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
      pricing: [],
      phone: '',
      webSite: '',
      socialLinks: Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, ''])),
      socialExtras: [],
      schedulesRows: WEEKDAYS_RU.map((d) => ({ day: d, enabled: false, start: '', end: '', note: '' })),
    };

    try {
      const payload = buildPayload({ ...empty, name: empty.name, slug: empty.slug });
      const r = await fetch(`/api/clubs`, {
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
      const r = await fetch(`/api/clubs/${encodeURIComponent(selectedClub.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      toastShow(setToast, 'Сохранено');

      lastLocationRef.current = String(updated.location || form.location || '');

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
      const r = await fetch(`/api/clubs/${encodeURIComponent(clubId)}`, {
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
        const r = await fetch(`/api/clubs/${encodeURIComponent(c.id)}`, {
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

  const fillMissingCoords = async () => {
    try {
      setLog('Запускаю /api/admin/geocode-missing…\n');
      const r = await fetch(`/api/admin/geocode-missing?limit=200&sleep_ms=200`, {
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
          Соцсети: VK / Telegram / WhatsApp / Instagram / YouTube (TikTok удалён).
        </div>
      </header>

      <div className="wrap">
        <aside className="left">
          <div className="toolbar">
            {activeTab === 'clubs' ? (
              <>
                <button className="btn" onClick={createNew} disabled={loading}>
                  + Новый
                </button>
                <button
                  className="btn ghost"
                  onClick={fillMissingCoords}
                  title="Бэкенд-утилита (если нужно)"
                >
                  Заполнить координаты
                </button>
                <button
                  className="btn ghost"
                  onClick={correctAllClientSide}
                  title="Коррекция координат всем (в браузере)"
                >
                  Коррекция (все)
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={createNewPost} disabled={blogLoading}>
                  + Новая статья
                </button>
                <button className="btn ghost" onClick={fetchBlogPosts} disabled={blogLoading}>
                  Обновить
                </button>
              </>
            )}
          </div>

          <div className="search">
            <div className="adminTabs" role="tablist" aria-label="Разделы админки">
              {ADMIN_TABS.map((t) => (
                <button
                  key={t.key}
                  className={`adminTabBtn ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.key}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <input
              value={activeTab === 'clubs' ? search : blogSearch}
              onChange={(e) => (activeTab === 'clubs' ? setSearch(e.target.value) : setBlogSearch(e.target.value))}
              placeholder={activeTab === 'clubs' ? 'Поиск кружка…' : 'Поиск статьи…'}
            />
          </div>

          <div className="list">
            {activeTab === 'clubs'
              ? filtered.map((c) => (
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
                      <p className="muted">lat: {c.lat ?? '—'} • lon: {c.lon ?? '—'}</p>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>📍</div>
                  </div>
                ))
              : filteredPosts.map((p) => (
                  <div
                    key={p.id}
                    className={`item ${String(p.id) === String(blogSelectedId) ? 'selected' : ''}`}
                    onClick={() => setBlogSelectedId(p.id)}
                  >
                    <div className="meta">
                      <h4>{p.title || '—'}</h4>
                      <p>
                        {(p.excerpt || p.slug || '').slice(0, 80)}
                        {(p.excerpt || p.slug || '').length > 80 ? '…' : ''}
                      </p>
                      <p className="muted">slug: {p.slug || '—'}</p>
                    </div>
                    <span className={`statusBadge ${p.status === 'published' ? 'published' : 'draft'}`}>
                      {p.status === 'published' ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </div>
                ))}

            {activeTab === 'blog' && !filteredPosts.length && (
              <div className="muted" style={{ padding: '8px 2px' }}>
                Пока нет статей. Нажми “+ Новая статья”.
              </div>
            )}
          </div>
        </aside>

        <main className="main">
          {activeTab === 'clubs' ? (
            <>

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
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setField('slug', sanitizeSlugTyped(e.target.value))}
                      onBlur={() => {
                        const base = String(form.slug || '').trim() || slugify(form.name);
                        const fin = finalizeSlug(base);
                        if (fin) setField('slug', fin);
                      }}
                      placeholder="sqkids"
                    />
                    <div className="muted" style={{ marginTop: 6 }}>Разрешено: <b>a-z</b>, <b>0-9</b>, <b>-</b>. Все остальное будет удалено/нормализовано.</div>
                  </div>
                </div>

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
                  <label>Meta Description (для SEO-сниппета)</label>
                  <textarea
                    value={form.metaDescription}
                    onChange={(e) => setField('metaDescription', String(e.target.value || '').slice(0, 160))}
                    rows={3}
                    placeholder="Короткое описание (лучше 140–160 символов)"
                  />
                  <div className="metaCounter">{String(form.metaDescription || '').length}/160</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Это поле пойдет в &lt;meta name="description"&gt;.
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label>Описание кружка (на странице)</label>
                  <div className="editorToolbar" style={{ marginTop: 8 }}>
                    <button type="button" className="miniBtn" onClick={() => clubAddHeading(2)}>H2</button>
                    <button type="button" className="miniBtn" onClick={() => clubAddHeading(3)}>H3</button>
                    <button type="button" className="miniBtn" onClick={() => clubAddHeading(4)}>H4</button>

                    <span className="editorSep" />

                    <button type="button" className="miniBtn" onClick={() => clubWrapSelection('<strong>', '</strong>', 'текст')}>B</button>
                    <button type="button" className="miniBtn" onClick={() => clubWrapSelection('<em>', '</em>', 'текст')}>I</button>

                    <span className="editorSep" />

                    <button type="button" className="miniBtn" onClick={clubAddLink} title="Вставить ссылку">🔗 Ссылка</button>
                    <button type="button" className="miniBtn" onClick={clubInsertAnchor} title="Вставить якорь (ID)">⚓ Якорь</button>
                    <button type="button" className="miniBtn" onClick={clubLinkToAnchor} title="Ссылка на якорь (#id)"># Ссылка</button>
                  </div>

                  <textarea
                    ref={clubDescRef}
                    value={form.descriptionHtml}
                    onChange={(e) => setField('descriptionHtml', e.target.value)}
                    style={{ minHeight: 220 }}
                    placeholder="Основной текст для страницы кружка (можно HTML-теги <h2>, <strong>, <a> и т.д.)"
                  />
                  <div className="muted" style={{ marginTop: 8 }}>
                    Будущий URL: <b>/club/{String(buildPayload(form).slug || '').trim()}</b>
                  </div>
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



                {/* Pricing (multiple items) */}
                <div className="pricingEditor" style={{ marginTop: 14 }}>
                  <div className="pricingHeader">
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>Стоимость занятий и абонементов</h3>
                      <div className="muted" style={{ marginTop: 6 }}>
                        Заполни несколько ценников (разовое, абонементы, индивидуально и т.д.).
                        Описание и «Подробнее» поддерживают <b>жирный</b>, <i>курсив</i> и ссылки.
                      </div>
                    </div>
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() =>
                        setForm((prev) => {
                          const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                          pricing.push({
                            kind: 'single',
                            title: '',
                            badge: '',
                            unit: 'за занятие',
                            price: '',
                            isFree: false,
                            desc: '',
                            details: '',
                          });
                          return { ...prev, pricing };
                        })
                      }
                    >
                      + Добавить позицию
                    </button>
                  </div>

                  {(!Array.isArray(form.pricing) || form.pricing.length === 0) && (
                    <div className="muted" style={{ marginTop: 10 }}>
                      Пока пусто. Нажми «Добавить позицию» — и сделаем красивый блок цен на странице кружка.
                    </div>
                  )}

                  {Array.isArray(form.pricing) && form.pricing.length > 0 && (
                    <div className="pricingList" style={{ marginTop: 12 }}>
                      {form.pricing.map((it, idx) => (
                        <div className="pricingItem" key={idx}>
                          <div className="pricingTop">
                            <div className="pricingTopLeft">
                              <div className="pricingIndex">#{idx + 1}</div>
                              <select
                                value={it.kind || 'single'}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                    const item = { ...(pricing[idx] || {}) };
                                    item.kind = e.target.value;
                                    pricing[idx] = item;
                                    return { ...prev, pricing };
                                  })
                                }
                              >
                                <option value="single">Разовое</option>
                                <option value="subscription">Абонементы</option>
                                <option value="individual">Индивидуально</option>
                                <option value="extra">Дополнительно</option>
                                <option value="trial">Пробное</option>
                              </select>
                              <input
                                type="text"
                                value={it.title || ''}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                    const item = { ...(pricing[idx] || {}) };
                                    item.title = e.target.value;
                                    pricing[idx] = item;
                                    return { ...prev, pricing };
                                  })
                                }
                                placeholder='Название (например "Разовое посещение")'
                              />
                              <input
                                type="text"
                                value={it.badge || ''}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                    const item = { ...(pricing[idx] || {}) };
                                    item.badge = e.target.value;
                                    pricing[idx] = item;
                                    return { ...prev, pricing };
                                  })
                                }
                                placeholder="Плашка (например: Выгодно)"
                              />
                            </div>

                            <div className="pricingTopRight">
                              <div className="pricingPriceCol">
                                <label>Цена, ₽</label>
                                <input
                                  type="number"
                                  value={it.price || ''}
                                  disabled={Boolean(it.isFree)}
                                  onChange={(e) =>
                                    setForm((prev) => {
                                      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                      const item = { ...(pricing[idx] || {}) };
                                      item.price = e.target.value;
                                      pricing[idx] = item;
                                      return { ...prev, pricing };
                                    })
                                  }
                                  placeholder="1500"
                                />
                              </div>
                              <label className="pricingFree">
                                <input
                                  type="checkbox"
                                  checked={Boolean(it.isFree)}
                                  onChange={(e) =>
                                    setForm((prev) => {
                                      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                      const item = { ...(pricing[idx] || {}) };
                                      item.isFree = e.target.checked;
                                      if (e.target.checked) item.price = '';
                                      pricing[idx] = item;
                                      return { ...prev, pricing };
                                    })
                                  }
                                />
                                Бесплатно
                              </label>

                              <div className="pricingControls">
                                <button
                                  type="button"
                                  className="iconBtn"
                                  title="Вверх"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    setForm((prev) => {
                                      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                      if (idx <= 0) return prev;
                                      const t = pricing[idx - 1];
                                      pricing[idx - 1] = pricing[idx];
                                      pricing[idx] = t;
                                      return { ...prev, pricing };
                                    })
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="iconBtn"
                                  title="Вниз"
                                  disabled={idx === form.pricing.length - 1}
                                  onClick={() =>
                                    setForm((prev) => {
                                      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                      if (idx >= pricing.length - 1) return prev;
                                      const t = pricing[idx + 1];
                                      pricing[idx + 1] = pricing[idx];
                                      pricing[idx] = t;
                                      return { ...prev, pricing };
                                    })
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="iconBtn danger"
                                  title="Удалить"
                                  onClick={() =>
                                    setForm((prev) => {
                                      const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                      pricing.splice(idx, 1);
                                      return { ...prev, pricing };
                                    })
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="pricingMid">
                            <div style={{ flex: 1 }}>
                              <label>Подпись к цене</label>
                              <input
                                type="text"
                                value={it.unit || ''}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                    const item = { ...(pricing[idx] || {}) };
                                    item.unit = e.target.value;
                                    pricing[idx] = item;
                                    return { ...prev, pricing };
                                  })
                                }
                                placeholder='например: "за занятие" / "за абонемент"'
                              />
                            </div>
                          </div>

                          <div className="pricingTextArea">
                            <div className="editorToolbar" style={{ marginBottom: 6 }}>
                              <button type="button" className="tool" onClick={() => pricingDescWrap(idx, '<strong>', '</strong>', 'жирный')}>B</button>
                              <button type="button" className="tool" onClick={() => pricingDescWrap(idx, '<em>', '</em>', 'курсив')}>I</button>
                              <button type="button" className="tool" onClick={() => pricingDescInsertLink(idx)}>Ссылка</button>
                            </div>
                            <textarea
                              ref={(el) => {
                                pricingDescRefs.current[idx] = el;
                              }}
                              value={it.desc || ''}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                  const item = { ...(pricing[idx] || {}) };
                                  item.desc = e.target.value;
                                  pricing[idx] = item;
                                  return { ...prev, pricing };
                                })
                              }
                              placeholder="Короткое описание (1–2 строки). Можно вставлять ссылки."
                              rows={3}
                            />
                          </div>

                          <details className="pricingDetails">
                            <summary>Подробнее (раскрывающийся текст)</summary>
                            <div className="pricingTextArea" style={{ marginTop: 10 }}>
                              <div className="editorToolbar" style={{ marginBottom: 6 }}>
                                <button type="button" className="tool" onClick={() => pricingDetailsWrap(idx, '<strong>', '</strong>', 'жирный')}>B</button>
                                <button type="button" className="tool" onClick={() => pricingDetailsWrap(idx, '<em>', '</em>', 'курсив')}>I</button>
                                <button type="button" className="tool" onClick={() => pricingDetailsInsertLink(idx)}>Ссылка</button>
                              </div>
                              <textarea
                                ref={(el) => {
                                  pricingDetailsRefs.current[idx] = el;
                                }}
                                value={it.details || ''}
                                onChange={(e) =>
                                  setForm((prev) => {
                                    const pricing = Array.isArray(prev.pricing) ? [...prev.pricing] : [];
                                    const item = { ...(pricing[idx] || {}) };
                                    item.details = e.target.value;
                                    pricing[idx] = item;
                                    return { ...prev, pricing };
                                  })
                                }
                                placeholder="Текст для раскрытия по клику «Подробнее»"
                                rows={4}
                              />
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  )}
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
        
            </>
          ) : (
            <>
              {!selectedPost ? (
                <div className="card">
                  <div className="muted">Выбери статью слева или создай новую.</div>
                </div>
              ) : (
                <div className="grid">
                  <section className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <h2 style={{ margin: 0, fontSize: 18 }}>Редактирование: {selectedPost.title || '—'}</h2>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={savePost} disabled={blogLoading}>
                          Сохранить
                        </button>
                      </div>
                    </div>

                    <div className="row" style={{ marginTop: 14 }}>
                      <div style={{ flex: 1 }}>
                        <label>Заголовок</label>
                        <input
                          type="text"
                          value={postForm.title}
                          onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
                        />
                      </div>
                      <div style={{ width: 320 }}>
                        <label>Slug</label>
                        <input
                          type="text"
                          value={postForm.slug}
                          onChange={(e) => setPostForm((p) => ({ ...p, slug: sanitizeSlugTyped(e.target.value) }))}
                          onBlur={() =>
                            setPostForm((p) => {
                              const base = String(p.slug || '').trim() || slugify(p.title);
                              const fin = finalizeSlug(base);
                              return {
                                ...p,
                                slug: fin || base || p.slug,
                              };
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="row" style={{ marginTop: 12 }}>
                      <div style={{ width: 220 }}>
                        <label>Статус</label>
                        <select
                          value={postForm.status}
                          onChange={(e) =>
                            setPostForm((p) => ({
                              ...p,
                              status: e.target.value,
                              publishedAt:
                                e.target.value === 'published'
                                  ? p.publishedAt || new Date().toISOString()
                                  : '',
                            }))
                          }
                        >
                          <option value="draft">Черновик</option>
                          <option value="published">Опубликовано</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>Дата публикации (ISO)</label>
                        <input
                          type="text"
                          value={postForm.publishedAt}
                          onChange={(e) => setPostForm((p) => ({ ...p, publishedAt: e.target.value }))}
                          placeholder="2026-01-16T12:00:00.000Z"
                          disabled={postForm.status !== 'published'}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label>Короткое описание (excerpt)</label>
                      <textarea
                        value={postForm.excerpt}
                        onChange={(e) => setPostForm((p) => ({ ...p, excerpt: e.target.value }))}
                        style={{ minHeight: 90 }}
                      />
                    </div>

                    <div className="row" style={{ marginTop: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label>Обложка (URL)</label>
                        <input
                          type="text"
                          value={postForm.coverImage}
                          onChange={(e) => setPostForm((p) => ({ ...p, coverImage: e.target.value }))}
                          placeholder="https://…"
                        />
                      </div>
                      <div style={{ width: 320 }}>
                        <label>Теги (через запятую)</label>
                        <input
                          type="text"
                          value={postForm.tagsText}
                          onChange={(e) => setPostForm((p) => ({ ...p, tagsText: e.target.value }))}
                          placeholder="спорт, развитие, досуг"
                        />
                        <div className="tags">
                          {String(postForm.tagsText || '')
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
                      <label>Контент</label>
                      <div className="editorToolbar" style={{ marginBottom: 8 }}>
                        <button type="button" className="miniBtn" onClick={() => editorAddHeading(2)} title="Заголовок H2">
                          H2
                        </button>
                        <button type="button" className="miniBtn" onClick={() => editorAddHeading(3)} title="Заголовок H3">
                          H3
                        </button>
                        <button type="button" className="miniBtn" onClick={() => editorAddHeading(4)} title="Заголовок H4">
                          H4
                        </button>

                        <span className="editorSep" />

                        <button
                          type="button"
                          className="miniBtn"
                          onClick={() => wrapSelection('<strong>', '</strong>', 'жирный')}
                          title="Жирный"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          className="miniBtn"
                          onClick={() => wrapSelection('<em>', '</em>', 'курсив')}
                          title="Курсив"
                        >
                          I
                        </button>

                        <span className="editorSep" />

                        <button type="button" className="miniBtn" onClick={editorAddLink} title="Вставить ссылку">
                          🔗 Ссылка
                        </button>
                        <button type="button" className="miniBtn" onClick={editorInsertAnchor} title="Вставить якорь (ID) в текущую позицию">
                          ⚓ Якорь
                        </button>
                        <button type="button" className="miniBtn" onClick={editorLinkToAnchor} title="Ссылка на якорь (#id)">
                          # Ссылка
                        </button>
                      </div>
                      <textarea
                        ref={blogContentRef}
                        value={postForm.content}
                        onChange={(e) => setPostForm((p) => ({ ...p, content: e.target.value }))}
                        style={{ minHeight: 280 }}
                      />
                      <div className="muted" style={{ marginTop: 8 }}>
                        Будущий URL: <b>/blog/{String(buildPostPayload(postForm).slug || '').trim()}</b>
                      </div>
                    </div>

                    {/* FAQ конструктор — отдельным блоком от контента */}
                    <div className="faqEditor">
                      <div className="faqHeader">
                        <div>
                          <label style={{ marginBottom: 0 }}>FAQ (частые вопросы)</label>
                          <div className="muted">
                            Для копирайтера: добавляй вопросы/ответы отдельным блоком. В ответе можно делать жирный/курсив и вставлять ссылки.
                          </div>
                        </div>
                        <button type="button" className="btn" onClick={faqAdd}>
                          + Добавить вопрос
                        </button>
                      </div>

                      {normalizeFaqItems(postForm.faq).length === 0 ? (
                        <div className="muted" style={{ marginTop: 10 }}>
                          Пока нет вопросов. Нажми «Добавить вопрос».
                        </div>
                      ) : (
                        <div className="faqList">
                          {normalizeFaqItems(postForm.faq).map((item, idx) => (
                            <div className="faqItem" key={idx}>
                              <div className="faqRow">
                                <div style={{ flex: 1 }}>
                                  <label>Вопрос #{idx + 1}</label>
                                  <input
                                    type="text"
                                    value={item.q || ''}
                                    onChange={(e) => faqUpdate(idx, { q: e.target.value })}
                                    placeholder="Например: С какого возраста можно?"
                                  />
                                </div>
                                <div className="faqControls">
                                  <button
                                    type="button"
                                    className="miniBtn"
                                    onClick={() => faqMove(idx, -1)}
                                    disabled={idx === 0}
                                    title="Вверх"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="miniBtn"
                                    onClick={() => faqMove(idx, +1)}
                                    disabled={idx === normalizeFaqItems(postForm.faq).length - 1}
                                    title="Вниз"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="miniBtn danger"
                                    onClick={() => faqRemove(idx)}
                                    title="Удалить"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <label>Ответ</label>
                                <div className="editorToolbar faqToolbar" style={{ marginBottom: 8 }}>
                                  <button
                                    type="button"
                                    className="miniBtn"
                                    onClick={() => faqWrapSelection(idx, '<strong>', '</strong>', 'жирный')}
                                    title="Жирный"
                                  >
                                    B
                                  </button>
                                  <button
                                    type="button"
                                    className="miniBtn"
                                    onClick={() => faqWrapSelection(idx, '<em>', '</em>', 'курсив')}
                                    title="Курсив"
                                  >
                                    I
                                  </button>

                                  <span className="editorSep" />

                                  <button type="button" className="miniBtn" onClick={() => faqInsertLink(idx)} title="Вставить ссылку">
                                    🔗 Ссылка
                                  </button>
                                </div>
                                <textarea
                                  ref={(el) => {
                                    faqAnswerRefs.current[idx] = el;
                                  }}
                                  value={item.a || ''}
                                  onChange={(e) => faqUpdate(idx, { a: e.target.value })}
                                  style={{ minHeight: 90 }}
                                  placeholder="Ответ..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="actions" style={{ marginTop: 14 }}>
                      <button className="btn danger" onClick={() => deletePost(selectedPost.id)} disabled={blogLoading}>
                        Удалить
                      </button>
                    </div>
                  </section>

                  <aside className="card">
                    <h3 style={{ margin: 0, fontSize: 16 }}>Логи</h3>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Тут видно сохранения и действия в режиме блога.
                    </div>
                    <div className="muted-log" style={{ marginTop: 10, maxHeight: 420, overflow: 'auto' }}>
                      {blogLog || '—'}
                    </div>

                    <div style={{ marginTop: 14 }} className="preview">
                      {postForm.coverImage ? (
                        <img src={postForm.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div className="muted">cover preview</div>
                      )}
                    </div>
                  </aside>
                </div>
              )}
            </>
          )}
</main>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
