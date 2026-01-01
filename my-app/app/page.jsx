import Header from '@/components/Header';
import ClubListClient from '@/components/ClubListClient';
import { getClubs } from '@/lib/api';

export const metadata = {
  title: 'Мапка - Найди кружок для ребёнка',
  description: 'Секции для детей и кружки рядом с домом: Мапка помогает найти занятия в Ростове-на-Дону по возрасту, району и расписанию — всё на карте.',
  alternates: { canonical: 'https://xn--80aa3agq.xn--p1ai/' },
};

export default async function Home() {
  const clubs = await getClubs();

  return (
    <>
      <Header />
      <ClubListClient initialClubs={clubs} />
    </>
  );
}
