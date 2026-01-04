// app/[slug]/page.jsx

import "./club.css";
import { notFound } from "next/navigation";
import ClubPageClient from "./ClubPageClient";
import { fetchClubData } from "./club-api";

// IMPORTANT: allow new slugs immediately (no pre-generated params restriction)
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const club = await fetchClubData(slug);

  if (!club) {
    return {
      title: "Кружок не найден",
      description: "Страница кружка не найдена.",
    };
  }

  const title = club.title || "Кружок";
  const address = club.address ? ` — ${club.address}` : "";
  const description = (club.description || "").slice(0, 160);

  return {
    title: `${title}${address} | Мапка`,
    description: description || `Кружок «${title}» на Мапка.`,
  };
}

export default async function ClubPage({ params }) {
  const slug = params?.slug;
  const club = await fetchClubData(slug);

  if (!club) {
    return notFound();
  }

  return <ClubPageClient club={club} />;
}
