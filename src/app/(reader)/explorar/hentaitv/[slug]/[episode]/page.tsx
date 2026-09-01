"use client";

import { use } from "react";
import { HentaitvOfficialEpisode } from "@/components/anime/HentaitvOfficialEpisode";

export default function EpisodioHentaitvPage(props: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = use(props.params);
  return <HentaitvOfficialEpisode slug={slug} episode={episode} />;
}
