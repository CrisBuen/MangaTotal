import { JkanimePlayer } from "@/components/anime/JkanimePlayer";

export default async function EpisodioJkanimePage(props: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const { slug, episode } = await props.params;
  return <JkanimePlayer slug={slug} episode={episode} />;
}
