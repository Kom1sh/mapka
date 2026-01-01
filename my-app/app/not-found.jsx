import Link from "next/link";

export const metadata = {
  title: "404 — Страница не найдена | Мапка",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const css = `
    .notfound-root * { margin: 0; padding: 0; box-sizing: border-box; }

    .notfound-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .notfound-root .header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #565555;
      color: #ffffff;
    }

    .notfound-root .header-inner {
      max-width: 1024px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      height: 56px;
      gap: 16px;
    }

    @media (min-width: 768px) {
      .notfound-root .header-inner {
        padding: 0 40px;
        height: 64px;
      }
    }

    .notfound-root .logo-link {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: inherit;
    }

    .notfound-root .logo-link img {
      height: 28px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      display: block;
    }

    @media (min-width: 768px) {
      .notfound-root .logo-link img {
        height: 32px;
        max-width: 180px;
      }
    }

    .notfound-root .logo-text {
      font-weight: 600;
      font-size: 18px;
      letter-spacing: 0.04em;
    }

    .notfound-root .header-right {
      font-size: 13px;
      opacity: 0.85;
    }

    .notfound-root .page-404 {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px 16px 40px;
    }

    .notfound-root .page-404-inner {
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border-radius: 24px;
      padding: 24px 20px 24px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
    }

    @media (min-width: 768px) {
      .notfound-root .page-404-inner {
        padding: 32px 32px 28px;
        border-radius: 28px;
      }
    }

    .notfound-root .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e4eff8;
      color: #1a1a1a;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .notfound-root .badge-icon {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #69afdf;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
    }

    .notfound-root .code-404 {
      font-size: 56px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #69afdf;
      margin-bottom: 8px;
    }

    .notfound-root .title {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .notfound-root .subtitle {
      font-size: 15px;
      color: #555;
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .notfound-root .hint {
      font-size: 13px;
      color: #777;
      margin-bottom: 16px;
    }

    .notfound-root .actions {
      margin-bottom: 20px;
    }

    .notfound-root .btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .notfound-root .btn-primary {
      background: #69afdf;
      color: #ffffff;
      box-shadow: 0 10px 24px rgba(105, 175, 223, 0.45);
    }

    .notfound-root .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 30px rgba(105, 175, 223, 0.55);
    }

    .notfound-root .btn svg {
      width: 18px;
      height: 18px;
    }

    .notfound-root .tip-links {
      font-size: 13px;
      color: #777;
    }

    .notfound-root .tip-links a {
      color: #69afdf;
      text-decoration: none;
    }

    .notfound-root .tip-links a:hover {
      text-decoration: underline;
    }
  `;

  return (
    <div className="notfound-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo-link" aria-label="Мапка">
            <img src="/logo.png" alt="Мапка" />
          </Link>
          <div className="header-right">Навигатор кружков и секций Ростова</div>
        </div>
      </header>

      <main className="page-404">
        <section className="page-404-inner">
          <div className="badge">
            <span className="badge-icon">404</span>
            <span>Страница не найдена</span>
          </div>

          <div className="code-404">Ой...</div>
          <h1 className="title">Такой страницы на Мапке нет</h1>
          <p className="subtitle">
            Возможно, вы перешли по старой ссылке, опечатались в адресе или кружок
            уже удалён из каталога. Но вы всегда можете вернуться на главную и
            подобрать другие активности для ребёнка.
          </p>

          <div className="actions">
            <Link href="/" className="btn btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.25h-5V21H5A1 1 0 0 1 4 20v-9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              На главную
            </Link>
          </div>

          <p className="hint">
            Если вы уверены, что по этой ссылке должна быть страница кружка или секции,
            напишите нам — мы проверим и всё поправим.
          </p>

          <p className="tip-links">
            Вернуться на <Link href="/">главную</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
