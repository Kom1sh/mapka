'use client';
import { useEffect, useState } from 'react';

export default function ClubActions({ phone }) {
  const [showFullPhone, setShowFullPhone] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false); // чтобы мобилка после второго клика показывала "Показать номер"

  useEffect(() => {
    const wrapper = document.querySelector('.club-main-wrapper');
    const titleEl = document.getElementById('headerScrollTitle');
    const shareBtn = document.getElementById('shareBtn');

    if (!wrapper) return;

    const onScroll = () => {
      if (!titleEl) return;
      titleEl.classList.toggle('visible', wrapper.scrollTop > 200);
    };

    const onShare = async () => {
      try {
        await navigator.clipboard?.writeText(window.location.href);
      } catch (_) {}
      alert('Ссылка скопирована!');
    };

    wrapper.addEventListener('scroll', onScroll);
    onScroll();

    if (shareBtn) shareBtn.addEventListener('click', onShare);

    return () => {
      wrapper.removeEventListener('scroll', onScroll);
      if (shareBtn) shareBtn.removeEventListener('click', onShare);
    };
  }, []);

  const maskPhone = (p) => {
    if (!p) return '';
    if (p.length < 10) return p;
    return p.substr(0, 8) + '••-••';
  };

  const togglePhone = () => {
    if (!phone) return;

    setShowFullPhone((prev) => {
      const next = !prev;
      if (next) {
        setHasBeenOpened(true);
        window.location.href = `tel:${phone}`;
      }
      return next;
    });
  };

  const desktopBtnText = showFullPhone ? phone : 'Показать номер';
  const mobileBtnText = showFullPhone ? phone : (hasBeenOpened ? 'Показать номер' : 'Позвонить');

  return (
    <>
      {/* SIDEBAR (desktop) */}
      <div className="sidebar-wrapper">
        <div className="sidebar-sticky">
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', color: '#777' }}>Запись в группу</div>
            <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--text-primary)', marginTop: '4px' }}>
              {phone ? maskPhone(phone) : ''}
            </div>
          </div>

          <button className="cta-btn btn-primary" onClick={togglePhone} type="button">
            {desktopBtnText}
          </button>

          <button className="cta-btn btn-outline" onClick={() => alert('Функция в разработке')} type="button">
            Написать сообщение
          </button>

          <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', lineHeight: '1.4', marginTop: '8px' }}>
            Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM BAR */}
      <div className="mobile-bottom-bar" id="mobileBottomBar">
        <button className="cta-btn btn-primary" style={{ flex: 1 }} onClick={togglePhone} type="button">
          {mobileBtnText}
        </button>

        <button
          className="cta-btn btn-outline"
          style={{ width: 'auto', padding: '12px' }}
          onClick={() => alert('Функция в разработке')}
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
    </>
  );
}
