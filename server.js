// server.js
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const fetch = require('node-fetch'); // ДОЛЖЕН быть node-fetch@2

const app = express();

const PORT = process.env.MAPKA_SSR_PORT || 3000;
const API_BASE = process.env.MAPKA_API_BASE || 'http://127.0.0.1:8000/api';
const PUBLIC_DIR = __dirname;

// Раздаём статику (js, картинки, css)
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
}));

// --- Кеш клубов ---
let clubsCache = {
  data: null,
  fetchedAt: 0,
};

const CACHE_TTL_MS = 60_000; // 60 секунд

async function getClubsFromAPI() {
  const now = Date.now();

  // если кеш свежий — сразу возвращаем
  if (clubsCache.data && now - clubsCache.fetchedAt < CACHE_TTL_MS) {
    return clubsCache.data;
  }

  // иначе идём в API
  const resp = await fetch(`${API_BASE}/clubs/`);
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }

  const data = await resp.json();
  clubsCache = {
    data,
    fetchedAt: Date.now(),
  };

  return data;
}

async function renderIndex(req, res) {
  try {
    const html = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

    let clubs = [];
    try {
      clubs = await getClubsFromAPI();
    } catch (e) {
      console.error('SSR: failed to fetch clubs', e);
    }

    // безопасно сериализуем JSON
    const serialized = JSON.stringify(clubs).replace(/</g, '\\u003c');

    const injection = `
<script>
  window.initialClubs = ${serialized};
</script>`;

    const outHtml = html.replace('</body>', `${injection}\n</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(outHtml);
  } catch (err) {
    console.error('SSR: renderIndex error', err);
    // фоллбек — просто отдаём index.html без данных
    try {
      const html = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch {
      res.status(500).send('SSR error');
    }
  }
}

// SSR только для корня
app.get('/', renderIndex);

app.listen(PORT, () => {
  console.log(`Mapka SSR server running on http://localhost:${PORT}`);
});
