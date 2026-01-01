'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header() {
  const [logoSrc, setLogoSrc] = useState('/logo.png');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logoContainer">
            <Link href="/">
              <img
                src={logoSrc}
                alt="Мапка"
                className="mainLogo"
                onError={() => setLogoSrc('https://via.placeholder.com/120x40?text=MAPKA')}
                suppressHydrationWarning
              />
            </Link>
          </div>

          <nav className="nav-desktop">
            <Link href="#">Все категории</Link>
            <Link href="/blog">Блог</Link>
            <Link href="#">Помощь</Link>
          </nav>

          <div className="header-right-desktop">
            <Link href="/favorites" className="icon-btn" aria-label="Избранное">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </Link>

            <Link href="#">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span>Ростов-на-Дону</span>
            </Link>

            <Link
              href="#"
              style={{ background: 'var(--bg-primary)', padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center' }}
            >
              <span>Войти</span>
              <div className="avatar" style={{ width: '24px', height: '24px', marginLeft: '8px', background: '#d1d5db' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path
                    fillRule="evenodd"
                    d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </Link>
          </div>

          <div className="header-right-mobile">
            <Link href="/favorites" className="icon-btn" aria-label="Избранное">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </Link>

            <button className="icon-btn" aria-label="Меню" type="button" onClick={() => setMenuOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`mobile-menu-overlay ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-menu ${menuOpen ? 'active' : ''}`}>
        <div className="mobile-menu-header">
          <button className="icon-btn" type="button" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mobile-menu-content">
          <div className="mobile-menu-profile">
            <div className="avatar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <div>
              <p style={{ fontWeight: 600 }}>Гость</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Ростов-на-Дону</p>
            </div>
          </div>

          <nav>
            <Link href="#" onClick={() => setMenuOpen(false)}>Все категории</Link>
            <Link href="/blog" onClick={() => setMenuOpen(false)}>Блог</Link>
            <Link href="#" onClick={() => setMenuOpen(false)}>Помощь</Link>
            <Link href="/favorites" onClick={() => setMenuOpen(false)}>Избранное</Link>
          </nav>
        </div>
      </div>
    </>
  );
}
