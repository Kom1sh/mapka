// app/not-found.jsx
import Link from "next/link";
import Header from "@/components/Header";

export const metadata = {
  title: "404 — Страница не найдена | Мапка",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Header />

      <main className="notfound-main">
        <section className="notfound-card" aria-labelledby="notfound-title">
          <div className="notfound-top">
            <div className="notfound-badge">404</div>
            <div className="notfound-kicker">Страница не найдена</div>
          </div>

          <h1 id="notfound-title" className="notfound-title">
            Такой страницы на Мапке нет
          </h1>

          <p className="notfound-subtitle">
            Возможно, ссылка устарела или вы опечатались в адресе. Вернитесь на
            главную — там карта и список кружков.
          </p>

          <div className="notfound-actions">
            <Link href="/" className="notfound-btn notfound-btn-primary">
              На главную
            </Link>
            <Link href="/blog" className="notfound-btn notfound-btn-secondary">
              В блог
            </Link>
          </div>

          <div className="notfound-hint">
            Подсказка: если вы искали кружок, попробуйте открыть главную и найти
            его через поиск.
          </div>
        </section>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .notfound-main {
              height: calc(100vh - var(--header-height));
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 24px 16px 40px;
            }

            .notfound-card {
              width: 100%;
              max-width: 560px;
              background: var(--bg-secondary);
              border-radius: 18px;
              border: 1px solid rgba(0,0,0,0.06);
              box-shadow: var(--shadow-lg);
              padding: 22px 18px 18px;
            }

            @media (min-width: 768px) {
              .notfound-card {
                padding: 28px 26px 22px;
                border-radius: 22px;
              }
            }

            .notfound-top {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 12px;
            }

            .notfound-badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              height: 28px;
              min-width: 48px;
              padding: 0 12px;
              border-radius: 999px;
              font-weight: 800;
              font-size: 13px;
              color: #fff;
              background: var(--accent-color);
              box-shadow: 0 10px 24px rgba(105, 175, 223, 0.35);
            }

            .notfound-kicker {
              font-size: 13px;
              font-weight: 600;
              color: var(--text-secondary);
            }

            .notfound-title {
              margin: 0;
              font-size: 22px;
              line-height: 1.15;
              letter-spacing: -0.02em;
              color: var(--text-primary);
              font-weight: 800;
            }

            @media (min-width: 768px) {
              .notfound-title {
                font-size: 26px;
              }
            }

            .notfound-subtitle {
              margin: 10px 0 16px;
              font-size: 14px;
              line-height: 1.55;
              color: var(--text-secondary);
            }

            .notfound-actions {
              display: grid;
              grid-template-columns: 1fr;
              gap: 10px;
              margin-bottom: 14px;
            }

            @media (min-width: 520px) {
              .notfound-actions {
                grid-template-columns: 1fr 1fr;
              }
            }

            .notfound-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              height: 44px;
              padding: 0 14px;
              border-radius: 12px;
              text-decoration: none;
              font-weight: 700;
              font-size: 14px;
              transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
            }

            .notfound-btn-primary {
              background: var(--accent-color);
              color: #fff;
              box-shadow: 0 10px 24px rgba(105, 175, 223, 0.35);
            }

            .notfound-btn-primary:hover {
              transform: translateY(-1px);
              box-shadow: 0 14px 30px rgba(105, 175, 223, 0.45);
            }

            .notfound-btn-secondary {
              background: var(--bg-input);
              color: var(--text-primary);
              border: 1px solid rgba(0,0,0,0.06);
            }

            .notfound-btn-secondary:hover {
              background: #e5e7eb;
            }

            .notfound-hint {
              font-size: 12.5px;
              line-height: 1.45;
              color: var(--text-secondary);
              padding-top: 12px;
              border-top: 1px solid rgba(0,0,0,0.06);
            }
          `,
        }}
      />
    </>
  );
}
