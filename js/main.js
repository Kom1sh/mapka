// js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // делегирование кликов по контейнеру карточек
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.cardLike');
    if (!btn) return;
    btn.classList.toggle('active');

    // для доступности
    const pressed = btn.classList.contains('active');
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
});
