"use client";

import { useState, useMemo } from "react";

// --- Вспомогательные функции ---
function formatPrice(price, priceNotes) {
  if (price == null) return null;
  const formatted = new Intl.NumberFormat("ru-RU").format(price);
  return `${formatted} ₽${priceNotes ? " " + priceNotes : ""}`;
}

function toAgeNum(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (!s || s === "null" || s === "undefined") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatAge(minAge, maxAge) {
  const min = toAgeNum(minAge);
  const max = toAgeNum(maxAge);

  if (min == null && max == null) return null;
  if (min == null) return `до ${max} лет`;
  if (max == null) return `от ${min} лет`;
  if (min === max) return `${min} лет`;
  return `${min}–${max} лет`;
}

function normalizePhotos(club) {
  if (!club || typeof club !== "object") return [];
  if (Array.isArray(club.photos) && club.photos.length > 0) return club.photos.filter(Boolean);
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

  const categoryTextRaw =
    typeof club.category === "string"
      ? club.category
      : club.category && typeof club.category === "object"
        ? club.category.name
        : "";

  const categoryText =
    typeof categoryTextRaw === "string" &&
    categoryTextRaw.trim() &&
    !["null", "undefined"].includes(categoryTextRaw.trim().toLowerCase())
      ? categoryTextRaw.trim()
      : "";

  const ageText = formatAge(club.minAge, club.maxAge);
  const priceText = formatPrice(club.price, club.priceNotes);

  const handleBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/";
    }
  };

  return (
    <div className="bg-[#F9FAFB] h-[calc(100vh-72px)] overflow-y-auto pb-24 lg:pb-10">
      <div className="max-w-[1100px] mx-auto px-4 py-6 lg:py-10">
        {/* Кнопка Назад */}
        <div className="mb-6">
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
        </div>

        {/* Сетка: Слева контент, Справа закрепленный сайдбар */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">
          {/* --- ЛЕВАЯ КОЛОНКА --- */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* Заголовок и бейджи */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {categoryText ? (
                  <span className="bg-[#69AFDF] text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">
                    {categoryText}
                  </span>
                ) : null}

                {ageText ? (
                  <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">
                    {ageText}
                  </span>
                ) : null}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                {club.title}
              </h1>

              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <svg
                  className="shrink-0"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>{club.address || club.address_text || club.location}</span>
              </div>
            </div>

            {/* Галерея */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-200 shadow-sm">
              <img
                src={photos[activePhotoIndex] || "https://dummyimage.com/800x600/eee/999?text=Нет+фото"}
                alt={club.title}
                className="h-full w-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all"
                    type="button"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() =>
                      setActivePhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all"
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
            </div>

            {/* Описание */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
                  {schedules.map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{s.day}</span>
                      <div className="text-right">
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-sm font-bold font-mono">
                          {s.time}
                        </span>
                        {s.note && <div className="text-xs text-gray-400 mt-1">{s.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- ПРАВАЯ КОЛОНКА (Sticky Sidebar) --- */}
          <aside className="hidden lg:flex flex-col gap-4 sticky top-6 self-start">
            {/* Блок действия (Телефон) */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 text-center">
              <div className="text-sm text-gray-500 mb-2">Запись в группу</div>
              <div className="text-xl font-extrabold text-gray-900 mb-6 tracking-wide">
                {club.phone || "+7 (XXX) ..."}
              </div>

              <div className="flex flex-col gap-3">
                {club.phone ? (
                  <a
                    href={`tel:${club.phone}`}
                    className="w-full bg-[#69AFDF] hover:bg-[#5b9bc5] text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Показать номер
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full bg-gray-200 text-gray-400 font-bold py-3 rounded-xl cursor-not-allowed"
                  >
                    Нет номера
                  </button>
                )}

                <button
                  onClick={() => alert("В разработке")}
                  className="w-full bg-white border border-gray-200 hover:border-[#69AFDF] hover:text-[#69AFDF] text-gray-700 font-bold py-3 rounded-xl transition-all"
                  type="button"
                >
                  Написать сообщение
                </button>
              </div>

              <div className="mt-4 text-[10px] text-gray-400 leading-tight px-2">
                Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
              </div>
            </div>

            {/* Блок цены */}
            {priceText && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 mb-1 font-medium text-[#69AFDF]">
                  Стоимость обучения
                </div>
                <div className="text-2xl font-extrabold text-gray-900">{priceText}</div>
                {club.priceNotes && (
                  <div className="text-xs text-green-600 mt-2 bg-green-50 inline-block px-2 py-1 rounded">
                    {club.priceNotes}
                  </div>
                )}
              </div>
            )}

            {/* Соцсети */}
            {club.socialLinks && Object.values(club.socialLinks).some(Boolean) && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">
                  Мы в соцсетях
                </div>
                <div className="flex flex-col gap-2">
                  {club.socialLinks.vk && (
                    <a
                      href={club.socialLinks.vk}
                      target="_blank"
                      className="flex items-center gap-2 text-sm font-medium text-[#0077FF] hover:underline p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      rel="noreferrer"
                    >
                      ВКонтакте
                    </a>
                  )}
                  {club.socialLinks.telegram && (
                    <a
                      href={club.socialLinks.telegram}
                      target="_blank"
                      className="flex items-center gap-2 text-sm font-medium text-[#24A1DE] hover:underline p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      rel="noreferrer"
                    >
                      Telegram
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Мобильная панель снизу */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:hidden z-50 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <a
            href={club.phone ? `tel:${club.phone}` : "#"}
            className="flex-1 bg-[#69AFDF] text-white font-bold rounded-xl flex items-center justify-center py-3"
          >
            {club.phone ? "Позвонить" : "Нет номера"}
          </a>
          <button
            onClick={() => alert("В разработке")}
            className="w-14 h-14 border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-500"
            type="button"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
