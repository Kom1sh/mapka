// server.js
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const fetch = require('node-fetch');   // v2, см. ниже про установку

const app = express();

const PORT = process.env.MAPKA_SSR_PORT || 3000;
const API_BASE =
  process.env.MAPKA_API_BASE || 'http://127.0.0.1:8000/api';

const PUBLIC_DIR = __dirname;

// раздаём статику (js, css, картинки)
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html']
}));

async function renderIndex(req, res) {
  try {
    // грузим исходный index.html
    const html = await fs.readFile(
      path.join(PUBLIC_DIR, 'index.html'),
      'utf8'
    );

    // тянем клубы из API
    const apiResp = await fetch(`${API_BASE}/clubs/`);
    let clubs = [];
    if (apiResp.ok) {
      clubs = await apiResp.json();
    } else {
      console.error('SSR: API error status', apiResp.status);
    }

    // сериализуем безопасно
    const serialized = JSON.stringify(clubs).replace(/</g, '\\u003c');

    const injection = `
<script>
  window.initialClubs = ${serialized};
</script>`;

    const resultHtml = html.replace('</body>', `${injection}\n</body>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(resultHtml);
  } catch (err) {
    console.error('SSR: failed to render index', err);
    // фоллбек — просто index.html без SSR
    try {
      const html = await fs.readFile(
        path.join(PUBLIC_DIR, 'index.html'),
        'utf8'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e2) {
      res.status(500).send('SSR error');
    }
  }
}

app.get('/', renderIndex);

app.listen(PORT, () => {
  console.log(`Mapka SSR server running on http://localhost:${PORT}`);
});
