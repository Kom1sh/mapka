// server.js
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Базовый адрес API — можешь переопределить через переменную окружения
// Например: API_BASE=http://127.0.0.1:8000/api node server.js
const API_BASE = process.env.API_BASE || 'https://xn--80aa3agq.xn--p1ai/api';

// В Node 24 fetch есть из коробки
const fetchFn = global.fetch;

// Раздаём статику из текущей папки (index.html, map.js, club.html, картинки и т.д.)
app.use(express.static(path.join(__dirname)));

// Формат цены так же, как у тебя на фронте
function formatPrice(price_cents) {
  if (price_cents === null || price_cents === undefined || price_cents === 0) {
    return { text: 'Бесплатно', isFree: true };
  }
  const priceRub = Math.round(price_cents / 100);
  return {
    text: `${priceRub.toLocaleString('ru-RU')} ₽`,
    isFree: false,
  };
}

// Нормализация клуба из API, чтобы не упасть, если чего-то нет
function normalizeClub(c) {
  // картинка: если относительный путь — делаем абсолютный
  let img = c.image || c.main_image_url || '';
  if (img && img.startsWith('/')) {
    img = `${new URL(API_BASE).origin}${img}`;
  }
  if (!img) {
    img = 'https://via.placeholder.com/400x400?text=No+image';
  }

  return {
    id: c.id,
    name: c.name || '',
    slug: c.slug || c.id,
    description: c.description || '',
    image: img,
    location: c.location || '',
    isFavorite: c.isFavorite || false,
    tags: c.tags || [],
    price_cents: c.price_cents ?? 0,
  };
}

// Разметка карточки (максимально близко к твоему createCardHTML из map.js)
function createCardHTML(club) {
  const price = formatPrice(club.price_cents);

  const tagsHtml = (club.tags || [])
    .map(
      (tag) =>
        `<button class="tag-btn" data-tag="${String(tag).toLowerCase()}">${tag}</button>`
    )
    .join('');

  return `
    <div class="club-card sectionCard"
         data-tags="${(club.tags || []).join(',').toLowerCase()}"
         data-price="${club.price_cents || 0}">
      <div class="card-top">
        <div class="card-image">
          <img src="${club.image}" alt="${club.name}">
          <button class="favorite-btn ${club.isFavorite ? 'active' : ''}" data-id="${club.id}">
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
        ${tagsHtml}
      </div>

      <div class="card-bottom">
        <div class="card-main-row">
          <span class="card-price ${price.isFree ? 'free' : ''}">${price.text}</span>
          <a href="/${encodeURIComponent(club.slug)}" class="card-btn">Подробнее</a>
        </div>
        <div class="card-location">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span class="cardLocationText">${club.location}</span>
        </div>
      </div>
    </div>
  `;
}

// SSR главной страницы с вставкой карточек
app.get('/', async (req, res) => {
  try {
    const resp = await fetchFn(`${API_BASE}/clubs`);
    if (!resp.ok) {
      throw new Error(`API /clubs status ${resp.status}`);
    }

    const rawClubs = await resp.json();
    const clubs = rawClubs.map(normalizeClub);
    const cardsHtml = clubs.map(createCardHTML).join('');

    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // Вставляем карточки в desktop
    html = html.replace(
      '<div class="cards-list" id="desktopCards"></div>',
      `<div class="cards-list" id="desktopCards">${cardsHtml}</div>`
    );

    // И в мобильный список
    html = html.replace(
      '<div class="sheet-cards" id="mobileCards"></div>',
      `<div class="sheet-cards" id="mobileCards">${cardsHtml}</div>`
    );

    // Плюс прокидываем данные на клиент, если захочешь использовать
    const dataScript = `<script>window.__SSR_CLUBS__ = ${JSON.stringify(
      clubs
    )};</script>`;
    html = html.replace('</body>', `${dataScript}</body>`);

    res.send(html);
  } catch (err) {
    console.error('SSR / error:', err);
    res.status(500).send('SSR error');
  }
});

// SSR страницы клуба по ЧПУ: /happy-swim
app.get('/:slug', async (req, res, next) => {
  const slug = req.params.slug;

  // Не перехватываем статику типа /map.js, /logo.png и пр.
  if (slug.includes('.')) {
    return next();
  }

  try {
    const resp = await fetchFn(`${API_BASE}/clubs`);
    if (!resp.ok) {
      throw new Error(`API /clubs status ${resp.status}`);
    }

    const rawClubs = await resp.json();
    const clubs = rawClubs.map(normalizeClub);
    const club =
      clubs.find((c) => c.slug === slug) ||
      clubs.find((c) => String(c.id) === slug);

    if (!club) {
      return res.status(404).send('Кружок не найден');
    }

    let html = fs.readFileSync(path.join(__dirname, 'club.html'), 'utf8');

    // Прокинем данные конкретного клуба на страницу
    const dataScript = `<script>window.__SSR_CLUB__ = ${JSON.stringify(
      club
    )};</script>`;
    html = html.replace('</body>', `${dataScript}</body>`);

    res.send(html);
  } catch (err) {
    console.error('SSR club error:', err);
    res.status(500).send('SSR error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
