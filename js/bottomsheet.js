// js/bottomsheet.js
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const map = document.getElementById('map');
  const sheet = document.getElementById('bottomSheet');
  const handle = sheet?.querySelector('.sheet-handle');
  const content = document.getElementById('sheetContent');
  const peekHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--peek-height')) || 80;
  const threshold = 80;

  if (!sheet || !handle || !content || !map) return;

  let startY = 0, currentY = 0;
  let isDragging = false;
  let lastTranslate = 0;

  const vh = () => window.innerHeight;

  function setPeekSnap() {
    sheet.style.transform = `translateY(calc(100vh - ${peekHeight}px))`;
  }
  function clearTransform() {
    sheet.style.transform = '';
  }

  function setMapFocused() {
    body.classList.add('map-focused');
    setPeekSnap();
  }
  function clearMapFocused() {
    body.classList.remove('map-focused');
    clearTransform();
  }

  function openFull() {
    sheet.classList.add('sheet-full');
    body.classList.add('no-scroll');
    sheet.style.transform = '';
  }
  function closeFull() {
    sheet.classList.remove('sheet-full');
    body.classList.remove('no-scroll');
    setPeekSnap();
  }

  // tap on map toggles peek (if not full)
  map.addEventListener('click', () => {
    if (sheet.classList.contains('sheet-full')) return;
    if (body.classList.contains('map-focused')) {
      // already focused -> clear
      clearMapFocused();
    } else {
      setMapFocused();
    }
  });

  // handle click toggles full/snap
  handle.addEventListener('click', () => {
    if (sheet.classList.contains('sheet-full')) {
      closeFull();
    } else {
      openFull();
    }
  });

  // helper to set translate
  function applyTranslate(y) {
    sheet.style.transform = `translateY(${y}px)`;
  }

  // pointer start
  function onPointerDown(e) {
    // only left button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDragging = true;
    startY = e.clientY;
    currentY = startY;
    lastTranslate = 0;
    sheet.style.transition = 'none';
    e.target.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    currentY = e.clientY;
    const dy = currentY - startY;
    const viewport = vh();

    // compute baseline translate depending on state
    if (sheet.classList.contains('sheet-full')) {
      // full -> translate down (max viewport height)
      const translate = Math.max(0, dy);
      applyTranslate(translate);
      lastTranslate = translate;
    } else if (body.classList.contains('map-focused')) {
      // peek -> baseline is peekTranslate (vh - peek)
      const peekTranslate = viewport - peekHeight;
      let translate = Math.max(0, peekTranslate + dy);
      // clamp between 0 and peekTranslate
      translate = Math.min(peekTranslate, translate);
      applyTranslate(translate);
      lastTranslate = translate;
    } else {
      // split -> small moves allowed (we'll let small upward if desired)
      const translate = Math.max(0, dy);
      applyTranslate(translate);
      lastTranslate = translate;
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    sheet.style.transition = '';
    const dy = currentY - startY;
    const absDy = Math.abs(dy);
    const viewport = vh();

    // Decision logic:
    // - If dragged up enough -> open full
    // - If dragged down enough -> go to peek
    // else snap back
    if (dy < -threshold) {
      // up
      openFull();
    } else if (dy > threshold) {
      // down
      // if was full -> go to peek
      if (sheet.classList.contains('sheet-full')) {
        closeFull();
      } else {
        setMapFocused();
      }
    } else {
      // small move => restore previous state
      if (sheet.classList.contains('sheet-full')) {
        openFull();
      } else if (body.classList.contains('map-focused')) {
        setMapFocused();
      } else {
        // split
        clearMapFocused();
      }
    }

    // release pointer capture safely
    try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  // Attach pointer events to handle and content
  handle.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // For dragging by content: only start drag when content.scrollTop <= 0 (so we don't intercept normal scroll)
  content.addEventListener('pointerdown', (e) => {
    if (content.scrollTop <= 0) {
      onPointerDown(e);
    }
  });

  // When content is scrolled and user drags inside content downwards, we want to handle pulling to close -> handled above

  // observe body class changes to snap peek position
  new MutationObserver(() => {
    if (body.classList.contains('map-focused') && !sheet.classList.contains('sheet-full')) {
      setPeekSnap();
    } else if (!body.classList.contains('map-focused') && !sheet.classList.contains('sheet-full')) {
      sheet.style.transform = '';
    }
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  // On resize clear transforms (let CSS handle)
  window.addEventListener('resize', () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
  });
});
