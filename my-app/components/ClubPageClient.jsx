"use client";

import { useState, useMemo } from "react";

// --- Вспомогательные функции ---
function toNum(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(price, priceNotes) {
  if (price == null) return null;
  const formatted = new Intl.NumberFormat("ru-RU").format(price);
  return `${formatted} ₽${priceNotes ? " " + priceNotes : ""}`;
}

function formatAge(minAge, maxAge) {
  const min = toNum(minAge);
  const max = toNum(maxAge);
  if (min == null && max == null) return null;
  if (min == null) return `до ${max} лет`;
  if (max == null) return `от ${min} лет`;
  if (min === max) return `${min} лет`;
  return `${min}–${max} лет`;
}

function normalizePhotos(club) {
  if (!club || typeof club !== "object") return [];
  // Если массив фото есть
  if (Array.isArray(club.photos) && club.photos.length > 0) return club.photos.filter(Boolean);
  // Если есть image или main_image_url
  if (club.main_image_url) return [club.main_image_url];
  if (club.image) return [club.image];
  return [];
}

function normalizeSchedules(club) {
  if (!club) return [];
  if (Array.isArray(club.schedules)) {
    return club.schedules.filter((s) => s && (s.day || s.time || s.note));
  }
  return [];
}

// --- Основной компонент ---
export default function ClubPageClient({ club }) {
  if (!club) {
    return <div className="h-screen flex items-center justify-center text-gray-500">Загрузка...</div>;
  }

  const photos = useMemo(() => normalizePhotos(club), [club]);
  const schedules = useMemo(() => normalizeSchedules(club), [club]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const categoryText = typeof club.category === "string"
    ? club.category.trim()
    : (club.category && typeof club.category === "object" && typeof club.category.name === "string"
        ? club.category.name.trim()
        : "");

  const ageText = formatAge(club.minAge, club.maxAge);
  const priceText = formatPrice(club.price, club.priceNotes);

  const handleBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Верхняя панель */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Назад
          </button>

          <button
            onClick={() => alert("Функция в разработке")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Поделиться"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .17 1L8.91 9.7a3 3 0 1 0 0 4.6l6.26 3.7A3 3 0 1 0 16 15a3 3 0 0 0-.17 1l-6.26-3.7a3 3 0 0 0 0-1.2L15.83 7a3 3 0 0 0 .17 1Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {/* Сетка: Слева контент, Справа закрепленный сайдбар */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">

          {/* --- ЛЕВАЯ КОЛОНКА --- */}
          <div className="flex flex-col gap-6 min-w-0">

            {/* Заголовок и бейджи */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {categoryText && (
                  <span className="bg-[#69AFDF] text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">
                    {categoryText}
                  </span>
                )}
                {ageText && (
                  <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">
                    {ageText}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                {club.title}
              </h1>

              {club.address ? (
                <div className="flex items-start gap-2 text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z" />
                    <path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  </svg>
                  <span className="text-sm sm:text-base">{club.address}</span>
                </div>
              ) : null}
            </div>

            {/* Галерея */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              {photos.length > 0 ? (
                <>
                  <img
                    src={photos[activePhotoIndex]}
                    alt={club.title || "Фото"}
                    className="w-full h-[240px] sm:h-[360px] object-cover"
                    loading="lazy"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg hover:bg-white transition-all"
                        aria-label="Предыдущее фото"
                        type="button"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg hover:bg-white transition-all"
                        aria-label="Следующее фото"
                        type="button"
                      >
                        ›
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {photos.map((_, idx) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${
                              idx === activePhotoIndex ? "bg-white w-4" : "bg-white/50"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-[240px] sm:h-[360px] bg-gray-200 flex items-center justify-center text-gray-500">
                  Нет фото
                </div>
              )}
            </div>

            {/* Описание */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {/* Для мобильных: цена в начале описания */}
              {priceText && (
                <div className="lg:hidden mb-6 pb-6 border-b border-gray-100">
                  <div className="text-sm text-gray-500 font-medium">Стоимость обучения</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">{priceText}</div>
                </div>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-3">О кружке</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {club.description || "Описание пока не добавлено."}
              </p>
            </div>

            {/* Расписание */}
            {schedules.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Расписание</h2>
                <div className="flex flex-col gap-3">
                  {schedules.map((s, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-4">
                      <div className="font-semibold text-gray-900">{s.day || "—"}</div>
                      <div className="text-gray-600 text-right">{s.time || s.note || ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- ПРАВАЯ КОЛОНКА (Сайдбар) --- */}
          <div className="lg:sticky lg:top-[104px] flex flex-col gap-6">

            {/* Карточка действий */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {/* Цена на десктопе */}
              {priceText && (
                <div className="hidden lg:block mb-6 pb-6 border-b border-gray-100">
                  <div className="text-sm text-gray-500 font-medium">Стоимость обучения</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">{priceText}</div>
                </div>
              )}

              {/* Запись в группу */}
              {club.phone ? (
                <>
                  <div className="text-sm text-gray-500 mb-2">Запись в группу</div>
                  <div className="text-xl font-extrabold text-gray-900 mb-4">
                    {club.phone.replace(/(\+?\d)(\d{3})(\d{3})(\d{2})(\d{2})/, "$1 ($2)•••-••-$5")}
                  </div>
                </>
              ) : (
                <div className="text-gray-500 mb-4">Контакты не указаны</div>
              )}

              <div className="flex flex-col gap-3">
                <a
                  href={club.phone ? `tel:${club.phone}` : "#"}
                  className={`w-full text-center px-4 py-3 rounded-xl font-bold transition-colors ${
                    club.phone ? "bg-[#69AFDF] text-white hover:opacity-90" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {club.phone ? "Показать номер" : "Нет номера"}
                </a>

                <button
                  onClick={() => alert("Функция в разработке")}
                  className="w-full px-4 py-3 rounded-xl font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                  type="button"
                >
                  Написать сообщение
                </button>
              </div>

              <div className="text-xs text-gray-400 mt-4">
                Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
              </div>
            </div>

            {/* Соцсети / сайт */}
            {(club.website || (club.socialLinks && Object.keys(club.socialLinks).length > 0)) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Контакты</h3>

                <div className="flex flex-col gap-3">
                  {club.website && (
                    <a
                      href={club.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-[#0b5c8a] hover:underline p-2 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M10 13a5 5 0 0 1 7 0l1 1a5 5 0 0 1 0 7 5 5 0 0 1-7 0l-1-1" />
                        <path d="M14 11a5 5 0 0 1-7 0l-1-1a5 5 0 0 1 0-7 5 5 0 0 1 7 0l1 1" />
                      </svg>
                      Сайт
                    </a>
                  )}

                  {club.socialLinks?.vk && (
                    <a
                      href={club.socialLinks.vk}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-[#0b5c8a] hover:underline p-2 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      ВКонтакте
                    </a>
                  )}

                  {club.socialLinks?.telegram && (
                    <a
                      href={club.socialLinks.telegram}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-[#0b5c8a] hover:underline p-2 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Telegram
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Мобильная панель снизу */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:hidden z-50 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <a
            href={club.phone ? `tel:${club.phone}` : "#"}
            className={`flex-1 text-center px-4 bg-[#69AFDF] text-white font-bold rounded-xl flex items-center justify-center py-3 ${
              club.phone ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            {club.phone ? "Позвонить" : "Нет номера"}
          </a>
          <button
            onClick={() => alert("В разработке")}
            className="w-14 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center text-gray-500"
            type="button"
            aria-label="Написать"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
