// app/layout.jsx
import "./globals.css";
import Script from "next/script";

const SITE_URL = "https://xn--80aa3agq.xn--p1ai";

// ✅ Отключаем "page zoom" (в т.ч. iOS zoom при фокусе на input)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  const jsonLdOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Мапка",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
  };

  const jsonLdWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Мапка",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/favicon.ico" />

        {/* ✅ JSON-LD (Organization) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
        />

        {/* ✅ JSON-LD (WebSite + SearchAction) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
      </head>

      <body>
        {children}

        {/* ✅ Yandex.Metrika counter */}
        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=105798797', 'ym');

ym(105798797, 'init', {
  ssr:true,
  webvisor:true,
  clickmap:true,
  ecommerce:"dataLayer",
  accurateTrackBounce:true,
  trackLinks:true
});
            `,
          }}
        />

        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/105798797"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>

        {/* ✅ Yandex Maps (v3) */}
        <Script
          src="https://api-maps.yandex.ru/v3/?apikey=58c38b72-57f7-4946-bc13-a256d341281a&lang=ru_RU"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
