// app/layout.jsx
import './globals.css';
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="icon" href="/favicon.ico" />
        {/* Можно добавить другие мета-теги здесь */}
      </head>
      <body>
        {children}
        
        {/* Подключаем скрипт Яндекс Карт */}
        {/* strategy="beforeInteractive" загружает скрипт в начале, чтобы карта была готова быстрее */}
        <Script 
          src="https://api-maps.yandex.ru/v3/?apikey=58c38b72-57f7-4946-bc13-a256d341281a&lang=ru_RU" 
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}