import Header from '@/components/Header';
import ClubListClient from '@/components/ClubListClient';
import { getClubs } from '@/lib/api';

export const metadata = {
  title: 'Мапка - Найди кружок для ребёнка',
  description: 'Поиск детских кружков и секций на карте Ростова-на-Дону',
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
