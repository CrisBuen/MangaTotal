"use client";

import { use } from "react";
import { ReproductorAnimeExterno } from "@/components/anime/JkanimePlayer";

export default function EpisodioTioanimePage(props: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = use(props.params);
  return (
    <ReproductorAnimeExterno
      slug={slug}
      episode={episode}
      source="tioanime"
      sourceName="TioAnime"
    />
  );
}
