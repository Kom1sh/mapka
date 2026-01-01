"use client";

// components/ClubCard.jsx
import Link from "next/link";

export default function ClubCard({
  club,
  onToggleFavorite,
  onTagClick,
  titleTag = "h2", // ✅ теперь поддерживаем titleTag
}) {
  // Форматирование цены
  const formatPrice = (cents) => {
    if (!cents) return { text: "Бесплатно", isFree: true };
    const rub = Math.round(cents / 100);
    return { text: `${rub.toLocaleString("ru-RU")} ₽`, isFree: false };
  };

  const price = formatPrice(club.price_cents);
  const imageUrl =
    club.image ||
    club.main_image_url ||
    "https://via.placeholder.com/400x400?text=No+image";

  // Обработка полных путей картинок
  const finalImage = imageUrl.startsWith("/")
    ? `https://mapkarostov.ru${imageUrl}`
    : imageUrl;

  const isFav = Boolean(club.isFavorite);

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onToggleFavorite === "function") onToggleFavorite(club.id);
  };

  const handleTagClick = (tag) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onTagClick === "function") onTagClick(tag);
  };

  // ✅ динамический тег заголовка (h2 на desktop, div на mobile)
  const TitleTag = titleTag && typeof titleTag === "string" ? titleTag : "h2";

  return (
    <div id={`club-card-${club.id}`} className="club-card sectionCard">
      <div className="card-top">
        <div className="card-image">
          <img
            src={finalImage}
            alt={club.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src =
                "https://via.placeholder.com/400x400?text=No+image";
            }}
          />

          <button
            type="button"
            className={`favorite-btn ${isFav ? "active" : ""}`}
            aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
            aria-pressed={isFav}
            onClick={handleFavoriteClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          </button>
        </div>

        <div className="card-content">
          <TitleTag className="card-title">{club.name}</TitleTag>

          <div className="card-description">{club.description}</div>

          <div className="card-tags">
            {(club.tags || []).slice(0, 3).map((tag, i) => (
              <button
                key={`${tag}-${i}`}
                type="button"
                className="tag-btn"
                onClick={handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}

            {(club.tags || []).length > 3 && (
              <span
                className="tag-btn"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-secondary)",
                }}
              >
                +{club.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-bottom">
        <div className="card-main-row">
          <div className="card-location">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
            <span className="cardLocationText">
              {club.location || club.address_text}
            </span>
          </div>
        </div>

        <div
          className="card-buttons"
          style={{
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <span className={`card-price ${price.isFree ? "free" : ""}`}>
            {price.text}
          </span>

          <Link href={`/${club.slug || club.id}`} className="card-btn">
            Подробнее
          </Link>
        </div>
      </div>
    </div>
  );
}
