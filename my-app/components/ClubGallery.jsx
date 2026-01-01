'use client';
import { useEffect, useRef, useState } from 'react';

const FALLBACK = 'https://dummyimage.com/1200x800/d1d5db/fff.png&text=No+Image';

export default function ClubGallery({ photos = [] }) {
  const list = Array.isArray(photos) && photos.length ? photos : [FALLBACK];
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const updateSlide = (idx) => {
    const next = (idx + list.length) % list.length;
    setCurrentPhotoIdx(next);
  };

  useEffect(() => {
    const track = document.getElementById('galleryTrack');
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

  return (
    <div className="gallery-container" id="galleryContainer">
      <div
        className="gallery-track"
        id="galleryTrack"
        style={{ transform: `translateX(${-currentPhotoIdx * 100}%)` }}
      >
        {list.map((src, i) => (
          <div className="gallery-slide" key={i}>
            <img
              src={src}
              alt="Фото"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK;
              }}
            />
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <>
          <button className="gallery-nav-btn prev" id="btnPrev" onClick={() => updateSlide(currentPhotoIdx - 1)} type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button className="gallery-nav-btn next" id="btnNext" onClick={() => updateSlide(currentPhotoIdx + 1)} type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="gallery-dots">
            {list.map((_, i) => (
              <div
                key={i}
                className={`gallery-dot ${i === currentPhotoIdx ? 'active' : ''}`}
                data-idx={i}
                onClick={() => updateSlide(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
