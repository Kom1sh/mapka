// server.js — нормальный SSR для главной

const express = require('express');
const path = require('path');
const fs = require('fs/promises');

// node-fetch через динамический import (работает в CJS)
const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

// адрес бекенда
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8000/api';

const app = express();
const PORT = process.env.PORT || 3000;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function normalizeClub(c) {
  let img = c.image || c.main_image_url || '';

  // если пришёл относительный путь — делаем абсолютным
  if (img && img.startsWith('/')) {
    // на проде Caddy сам отдаёт статику из /var/www/mapka
    // можно без домена, но абсолютный URL тоже норм
    img = 'https://mapkarostov.ru' + img;
  }

  return {
    id: c.id,
    name: c.name || '',
    slug: c.slug || c.id,
    description: c.description || '',
    image: img || 'https://via.placeholder.com/400x400?text=No+image',
    location: c.location || '',
    isFavorite: false,
    tags: c.tags || [],
    price_cents: c.price_cents || null,
  };
}

function formatPrice(price_cents) {
  if (!price_cents) {
    return { text: 'Бесплатно', isFree: true };
  }
  const priceRub = Math.round(price_cents / 100);
  return { text: `${priceRub.toLocaleString('ru-RU')} ₽`, isFree: false };
}

function createCardHTML(club) {
  const price = formatPrice(club.price_cents);

  return `
    <div class="club-card sectionCard" data-tags="${(club.tags || [])
      .join(',')
      .toLowerCase()}" data-price="${club.price_cents || 0}">
      <div class="card-top">
        <div class="card-image">
          <img src="${club.image}" alt="${club.name}">
          <button class="favorite-btn ${club.isFavorite ? 'active' : ''}" data-id="${
    club.id
  }">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </button>
        </div>
        <div class="card-content">
          <h2 class="card-title">${club.name}</h2>
          <div class="card-description">${club.description}</div>
        </div>
      </div>
      <div class="card-tags">
        ${(club.tags || [])
          .map(
            (tag) =>
              `<button class="tag-btn" data-tag="${tag.toLowerCase()}">${tag}</button>`,
          )
          .join('')}
      </div>
      <div class="card-bottom">
        <div class="card-location">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span class="cardLocationText">${club.location}</span>
        </div>
        <span class="card-price ${price.isFree ? 'free' : ''}">${price.text}</span>
        <div class="card-buttons">
          <a href="club.html?slug=${club.slug}" class="card-btn">Подробнее</a>
          <button class="card-btn">Написать</button>
        </div>
      </div>
    </div>
  `;
}

async function getClubsForSSR() {
  try {
    const res = await fetch(`${API_BASE}/clubs/`);
    if (!res.ok) {
      console.error('SSR: bad status from API', res.status);
      return [];
    }
    const raw = await res.json();
    return raw.map(normalizeClub);
  } catch (e) {
    console.error('SSR: failed to fetch clubs', e);
    return [];
  }
}

async function renderIndex() {
  const filePath = path.join(__dirname, 'index.html');
  let html = await fs.readFile(filePath, 'utf8');

  const clubs = await getClubsForSSR();
  const cardsHtml = clubs.map(createCardHTML).join('\n');

  // Вставляем карточки в placeholder'ы
  html = html.replace('<!--SSR_DESKTOP_CARDS-->', cardsHtml);
  html = html.replace('<!--SSR_MOBILE_CARDS-->', cardsHtml);

  // Прокидываем данные на клиент, чтобы не было повторного fetch
  const dataScript =
    `<script>window.__INITIAL_CLUBS__ = ${JSON.stringify(clubs)};</script>`;
  html = html.replace('</body>', `${dataScript}\n</body>`);

  return html;
}

// ===== ROUTES =====

// SSR для / и /index.html
app.get(['/', '/index.html'], async (req, res) => {
  try {
    const html = await renderIndex();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('SSR: error in handler', e);
    res.status(500).send('Internal Server Error');
  }
});

// статика: map.js, club.html, 404.html, картинки и т.д.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Mapka SSR server running on http://localhost:${PORT}`);
});
