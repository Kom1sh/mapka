'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const FALLBACK = 'https://dummyimage.com/1200x800/d1d5db/fff.png&text=No+Image';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export default function ClubGallery({ photos = [] }) {
  const list = useMemo(() => {
    return Array.isArray(photos) && photos.length ? photos : [FALLBACK];
  }, [photos]);

  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // zoom / pan (only for modal)
  const [zoom, setZoom] = useState(1); // 1..3
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const stageRef = useRef(null);
  const dragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const updateSlide = (idx) => {
    const next = (idx + list.length) % list.length;
    setCurrentPhotoIdx(next);
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const openModal = () => {
    setIsOpen(true);
    // сразу сбрасываем зум на открытии
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const closeModal = () => {
    setIsOpen(false);
    // и на закрытии тоже
    resetZoom();
  };

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

  // Modal: esc + arrows + scroll lock + reset zoom when switching photos
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // ✅ при переключении фото — вернуть дефолтный масштаб
    resetZoom();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();

      if (list.length > 1 && e.key === 'ArrowRight') updateSlide(currentPhotoIdx + 1);
      if (list.length > 1 && e.key === 'ArrowLeft') updateSlide(currentPhotoIdx - 1);

      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
      if (e.key.toLowerCase() === 'r') resetZoom();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentPhotoIdx, list.length]);

  const currentSrc = list[currentPhotoIdx] || FALLBACK;

  const clampPanToStage = (nextPan, nextZoom) => {
    const el = stageRef.current;
    if (!el) return nextPan;

    const rect = el.getBoundingClientRect();
    const maxX = ((nextZoom - 1) * rect.width) / 2;
    const maxY = ((nextZoom - 1) * rect.height) / 2;

    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  };

  const setZoomSafe = (nextZoom) => {
    const z = clamp(nextZoom, 1, 3);
    setZoom(z);

    if (z === 1) {
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
      return;
    }

    setPan((p) => clampPanToStage(p, z));
  };

  const zoomIn = () => setZoomSafe(zoom + 0.25);
  const zoomOut = () => setZoomSafe(zoom - 0.25);

  const onStageWheel = (e) => {
    // зум по колесу мыши/тачпаду
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const step = 0.15;
    setZoomSafe(zoom + dir * step);
  };

  const onStageDoubleClick = () => {
    // быстрый toggle 1x <-> 2x
    if (zoom === 1) setZoomSafe(2);
    else resetZoom();
  };

  const onPointerDown = (e) => {
    if (zoom === 1) return; // таскаем только когда приближено
    const el = stageRef.current;
    if (!el) return;

    el.setPointerCapture?.(e.pointerId);
    setIsDragging(true);

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const onPointerMove = (e) => {
    if (!isDragging || zoom === 1) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const nextPan = {
      x: dragRef.current.startPanX + dx,
      y: dragRef.current.startPanY + dy,
    };

    setPan(clampPanToStage(nextPan, zoom));
  };

  const onPointerUp = (e) => {
    const el = stageRef.current;
    el?.releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
  };

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

            {/* Zoom controls */}
            <div className="gallery-modal-controls" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="gm-ctrl" onClick={zoomOut} aria-label="Уменьшить">
                −
              </button>
              <div className="gm-zoom">{Math.round(zoom * 100)}%</div>
              <button type="button" className="gm-ctrl" onClick={zoomIn} aria-label="Увеличить">
                +
              </button>
              <button type="button" className="gm-ctrl gm-reset" onClick={resetZoom} aria-label="Сбросить масштаб">
                1×
              </button>
            </div>

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

            <div
              className="gallery-modal-stage"
              ref={stageRef}
              onWheel={onStageWheel}
              onDoubleClick={onStageDoubleClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                className={`gallery-modal-img ${zoom > 1 ? 'zoomed' : ''} ${isDragging ? 'dragging' : ''}`}
                src={currentSrc}
                alt="Фото крупно"
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK;
                }}
              />
            </div>

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
