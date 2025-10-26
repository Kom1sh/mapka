// js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // Delegated listener for like buttons (works for dynamically added cards)
  document.body.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.cardLike');
    if (!likeBtn) return;
    likeBtn.classList.toggle('active');
    const pressed = likeBtn.classList.contains('active');
    likeBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });

  // Burger menu toggle
  const burger = document.getElementById('burgerBtn');
  const offcanvas = document.getElementById('offcanvas');
  const closeOff = document.getElementById('closeOffcanvas');

  burger?.addEventListener('click', () => {
    if (!offcanvas) return;
    const open = offcanvas.classList.toggle('open');
    offcanvas.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  closeOff?.addEventListener('click', () => {
    offcanvas?.classList.remove('open');
    offcanvas?.setAttribute('aria-hidden', 'true');
  });

  // Close offcanvas by clicking backdrop (click outside)
  document.addEventListener('click', (e) => {
    if (!offcanvas || offcanvas.classList.contains('open') === false) return;
    if (!e.target.closest('#offcanvas') && !e.target.closest('#burgerBtn')) {
      offcanvas.classList.remove('open');
      offcanvas.setAttribute('aria-hidden', 'true');
    }
  });

  // Make sure images do not produce horizontal overflow
  const imgs = document.querySelectorAll('img');
  imgs.forEach(img => {
    img.style.maxWidth = '100%';
    img.style.display = 'block';
  });
});
