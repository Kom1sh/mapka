'use client';
import { useEffect, useRef, useState } from 'react';

const FALLBACK = 'https://dummyimage.com/1200x800/d1d5db/fff.png&text=No+Image';

export default function ClubGallery({ photos = [] }) {
  const list = Array.isArray(photos) && photos.length ? photos : [FALLBACK];

  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const updateSlide = (idx) => {
    const next = (idx + list.length) % list.length;
    setCurrentPhotoIdx(next);
  };

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  // Swipe on gallery track
  useEffect(() => {
    const track = trackRef.current;
    if (!track || list.length <= 1) return;

    const onTouchStart = (e) => {
      if (!e.touches?.length) return;
      startXRef.current = e.touches[0].clientX;
      draggingRef.current = true;
    };

    const onTouchEnd = (e) => {
      if (!draggingRef.current) return;
      const endX = e.changedTouches?.[0]?.clientX ?? startXRef.current;
      const diff = startXRef.current - endX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) updateSlide(currentPhotoIdx + 1);
        else updateSlide(currentPhotoIdx - 1);
      }
      draggingRef.current = false;
    };

    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      track.removeEventListener('touchstart', onTouchStart);
      track.removeEventListener('touchend', onTouchEnd);
    };
  }, [currentPhotoIdx, list.length]);

  // Modal: esc + arrows + scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (list.length > 1 && e.key === 'ArrowRight') updateSlide(currentPhotoIdx + 1);
      if (list.length > 1 && e.key === 'ArrowLeft') updateSlide(currentPhotoIdx - 1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, currentPhotoIdx, list.length]);

  const currentSrc = list[currentPhotoIdx] || FALLBACK;

  return (
    <>
      <div className="gallery-container" id="galleryContainer">
        <div
          className="gallery-track"
          ref={trackRef}
          style={{ transform: `translateX(${-currentPhotoIdx * 100}%)` }}
        >
          {list.map((src, i) => (
            <div
              className="gallery-slide"
              key={i}
              // фон для blur-эффекта
              style={{ ['--bg']: `url("${src}")` }}
            >
              <img
                src={src}
                alt="Фото"
                loading="lazy"
                onClick={openModal}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK;

                  // чтобы blur-фон тоже был корректным
                  const slide = e.currentTarget.closest('.gallery-slide');
                  if (slide) slide.style.setProperty('--bg', `url("${FALLBACK}")`);
                }}
              />
            </div>
          ))}
        </div>

        {list.length > 1 && (
          <>
            <button
              className="gallery-nav-btn prev"
              onClick={() => updateSlide(currentPhotoIdx - 1)}
              type="button"
              aria-label="Предыдущее фото"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              className="gallery-nav-btn next"
              onClick={() => updateSlide(currentPhotoIdx + 1)}
              type="button"
              aria-label="Следующее фото"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="gallery-dots" aria-label="Переключение фото">
              {list.map((_, i) => (
                <div
                  key={i}
                  className={`gallery-dot ${i === currentPhotoIdx ? 'active' : ''}`}
                  onClick={() => updateSlide(i)}
                  role="button"
                  tabIndex={0}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {isOpen && (
        <div className="gallery-modal-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="gallery-modal" onClick={(e) => e.stopPropagation()}>
            <button className="gallery-modal-close" onClick={closeModal} type="button" aria-label="Закрыть">
              ✕
            </button>

            {list.length > 1 && (
              <>
                <button
                  className="gallery-modal-nav prev"
                  onClick={() => updateSlide(currentPhotoIdx - 1)}
                  type="button"
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
                <button
                  className="gallery-modal-nav next"
                  onClick={() => updateSlide(currentPhotoIdx + 1)}
                  type="button"
                  aria-label="Следующее фото"
                >
                  ›
                </button>
              </>
            )}

            <img
              className="gallery-modal-img"
              src={currentSrc}
              alt="Фото крупно"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK;
              }}
            />

            {list.length > 1 && (
              <div className="gallery-modal-counter">
                {currentPhotoIdx + 1} / {list.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
