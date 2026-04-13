import EpisodeViewer from "./episode-viewer";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { buildDatasetId, getDatasetDisplayName } from "@/utils/datasetSource";
import { fetchEpisodeDataSafe } from "./actions";

const THEME_STORAGE_KEY = "episode-viewer-theme";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; dataset: string; episode: string }>;
}) {
  const { org, dataset, episode } = await params;
  return {
    title: `${getDatasetDisplayName(buildDatasetId(org, dataset))} | episode ${episode}`,
  };
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ org: string; dataset: string; episode: string }>;
}) {
  const { org, dataset, episode } = await params;
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_STORAGE_KEY)?.value;
  const initialTheme = themeCookie === "light" ? "light" : "dark";
  const episodeNumber = Number(episode.replace(/^episode_/, ""));
  const initialResult = await fetchEpisodeDataSafe(org, dataset, episodeNumber);

  return (
    <Suspense fallback={null}>
      <EpisodeViewer
        org={org}
        dataset={dataset}
        episodeId={episodeNumber}
        initialTheme={initialTheme}
        initialData={initialResult.data ?? null}
        initialError={initialResult.error ?? null}
      />
    </Suspense>
  );
}
