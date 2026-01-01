const API_BASE = 'https://mapkarostov.ru/api';

// Получить все клубы (для главной)
export async function getClubs() {
  try {
    const res = await fetch(`${API_BASE}/clubs/`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch clubs');
    return res.json();
  } catch (error) {
    console.error("Error fetching clubs:", error);
    return [];
  }
}

// Получить один клуб по slug или id
export async function getClubBySlug(slug) {
  try {
    // Поскольку у API нет эндпоинта /clubs/:slug, берем все и ищем нужный
    // В реальном проекте лучше сделать отдельный эндпоинт на бэкенде
    const allClubs = await getClubs();
    
    // Ищем по slug или id
    const found = allClubs.find(c => String(c.slug) === String(slug) || String(c.id) === String(slug));
    
    return found || null;
  } catch (error) {
    console.error("Error fetching club:", error);
    return null;
  }
}