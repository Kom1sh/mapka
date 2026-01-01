import Header from "@/components/Header";
import FavoritesPageClient from "./FavoritesPageClient";
import "./favorites.css";

export const metadata = {
  title: "Избранные кружки и секции - Мапка",
  description:
    "Ваш личный список отобранных кружков и секций. Сравнивайте, выбирайте и записывайтесь на занятия.",
  alternates: {
    canonical: "https://xn--80aa3agq.xn--p1ai/favorites",
  },
  openGraph: {
    title: "Мои избранные секции - Мапка",
    description: "Список лучших кружков для моего ребенка.",
    type: "website",
  },
};

export default function FavoritesPage() {
  return (
    <>
      <Header />
      <FavoritesPageClient />
    </>
  );
}
