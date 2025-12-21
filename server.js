// server.js
// SSR + динамический sitemap для Мапки

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
// ОБЯЗАТЕЛЬНО: node-fetch версии 2.x
// npm i node-fetch@2 --save
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.MAPKA_SSR_PORT || 3000;
// API крутится на localhost:8000/api
const API_BASE =
  process.env.MAPKA_API_BASE || 'http://localhost:8000/api';

// корень фронта (там же index.html, blog.html и т.д.)
const PUBLIC_DIR = __dirname;

// ================= КЕШ КЛУБОВ =================

let clubsCache = {
  data: null,
  fetchedAt: 0,
};

const CACHE_TTL_MS = 60_000; // 60 секунд

async function getClubsFromAPI() {
  const now = Date.now();

  // свежий кеш — отдаём его
  if (clubsCache.data && now - clubsCache.fetchedAt < CACHE_TTL_MS) {
    return clubsCache.data;
  }

  // иначе тянем из API
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

// ================= SSR ДЛЯ ГЛАВНОЙ =================

async function renderIndex(req, res) {
  try {
    const html = await fs.readFile(
      path.join(PUBLIC_DIR, 'index.html'),
      'utf8'
    );

    let clubs = [];
    try {
      clubs = await getClubsFromAPI();
    } catch (e) {
      console.error('SSR: failed to fetch clubs', e);
    }

    // безопасная сериализация под window.initialClubs
    const serialized = JSON.stringify(clubs).replace(/</g, '\\u003c');

    const injection = `
<script>
  // Данные для первичного рендера (SSR + hydratation)
  window.initialClubs = ${serialized};
</script>`;

    const outHtml = html.replace('</body>', `${injection}\n</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(outHtml);
  } catch (err) {
    console.error('SSR: renderIndex error', err);

    // Фоллбек — просто index.html без данных
    try {
      const html = await fs.readFile(
        path.join(PUBLIC_DIR, 'index.html'),
        'utf8'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch {
      res.status(500).send('SSR error');
    }
  }
}

// ================= ДИНАМИЧЕСКИЙ SITEMAP =================

app.get('/sitemap.xml', async (req, res) => {
  try {
    let clubs = [];
    try {
      const resp = await fetch(`${API_BASE}/clubs/`);
      if (resp.ok) {
        clubs = await resp.json();
      }
    } catch (e) {
      console.error('sitemap: clubs fetch error', e);
    }

    const host = req.headers.host || 'xn--80aa3agq.xn--p1ai';
    const origin = `https://${host}`;

    const urls = [];

    // базовые страницы
    urls.push({ loc: `${origin}/`, changefreq: 'daily', priority: 1.0 });
    urls.push({
      loc: `${origin}/blog`,
      changefreq: 'weekly',
      priority: 0.8,
    });
    urls.push({
      loc: `${origin}/favorites`,
      changefreq: 'weekly',
      priority: 0.6,
    });

    // страницы кружков /slug
    for (const club of clubs) {
      const slug = club.slug || club.id;
      if (!slug) continue;
      urls.push({
        loc: `${origin}/${slug}`,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${u.loc}</loc>\n` +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            `  </url>`
        )
        .join('\n') +
      `\n</urlset>\n`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('sitemap error', err);
    res.status(500).send('Error generating sitemap');
  }
});

// ================= МАРШРУТЫ =================

// SSR только для корня
app.get('/', renderIndex);

// Всё остальное — статика (index.html, blog.html, favorites.html,
// club.html, JS, CSS, картинки и т.д.)
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
  })
);

// ================= СТАРТ =================

app.listen(PORT, () => {
  console.log(`Mapka SSR server running on http://localhost:${PORT}`);
});
