import Header from '@/components/Header';
import ClubListClient from '@/components/ClubListClient';
import { getClubs } from '@/lib/api';

const SITE_URL = 'https://xn--80aa3agq.xn--p1ai';

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export const metadata = {
  title: 'Мапка - Найди кружок для ребёнка',
  description:
    'Секции для детей и кружки рядом с домом: Мапка помогает найти занятия в Ростове-на-Дону по возрасту, району и расписанию — всё на карте.',
  alternates: { canonical: 'https://xn--80aa3agq.xn--p1ai/' },
};

export default async function Home() {
  const clubs = await getClubs();

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE_URL}/#clubs`,
    name: 'Кружки и секции',
    itemListElement: (clubs || []).slice(0, 200).map((c, idx) => {
      const slug = c.slug || c.id;
      const name = c.title || c.name || slug;
      return {
        '@type': 'ListItem',
        position: idx + 1,
        url: `${SITE_URL}/${slug}`,
        name,
      };
    }),
  };

  const homePage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/#homepage`,
    url: `${SITE_URL}/`,
    name: metadata.title,
    description: metadata.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#clubs` },
    inLanguage: 'ru-RU',
  };

  return (
    <>
      {/* Schema.org: HomePage + ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homePage) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(itemList) }}
      />

      <Header />
      <ClubListClient initialClubs={clubs} />
    </>
  );
}
