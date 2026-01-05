// app/layout.jsx
import './globals.css';
import Script from 'next/script';

const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';

function jsonLd(obj) {
  // защита от </script> инъекций
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Мапка',
  url: SITE_URL,
  description:
    'Мапка — сервис поиска детских кружков и секций в Ростове-на-Дону: по возрасту, району и расписанию.',
  areaServed: 'Ростов-на-Дону',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Мапка',
  inLanguage: 'ru-RU',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/favicon.ico" />

        {/* Schema.org: Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteJsonLd) }}
        />
      </head>

      <body>
        {children}

        {/* Подключаем скрипт Яндекс Карт */}
        <Script
          src="https://api-maps.yandex.ru/v3/?apikey=58c38b72-57f7-4946-bc13-a256d341281a&lang=ru_RU"
          strategy="beforeInteractive"
        />

        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {
                  if (document.scripts[j].src === r) { return; }
                }
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=105798797', 'ym');

            ym(105798797, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>

        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/105798797"
              style={{ position: 'absolute', left: '-9999px' }}
              alt=""
            />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}
      </body>
    </html>
  );
}
