import ExploreGrid from "./explore-grid";
import { formatStringWithVars } from "@/utils/parquetUtils";
import {
  buildVersionedUrl,
  getDatasetVersionAndInfo,
} from "@/utils/versionUtils";

const DATASETS_PER_PAGE = 30;
const EXPLORE_DATASET_CONCURRENCY = 6;

type DatasetListEntry = { id: string };
type DatasetPreview = { id: string; videoUrl: string | null };

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const params = await searchParams;
  let datasets: DatasetListEntry[] = [];
  let currentPage = 1;
  let totalPages = 1;
  try {
    const res = await fetch(
      "https://huggingface.co/api/datasets?sort=lastModified&filter=LeRobot",
      {
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error("Failed to fetch datasets");
    const data = await res.json();
    const allDatasets = data.datasets || data;
    // Use params from props
    const page = parseInt(params?.p || "1", 10);
    currentPage = page;
    totalPages = Math.ceil(allDatasets.length / DATASETS_PER_PAGE);

    const startIdx = (currentPage - 1) * DATASETS_PER_PAGE;
    const endIdx = startIdx + DATASETS_PER_PAGE;
    datasets = allDatasets.slice(startIdx, endIdx);
  } catch {
    return <div className="p-8 text-red-600">Failed to load datasets.</div>;
  }

  const datasetWithVideos = (
    await mapWithConcurrency(
      datasets,
      EXPLORE_DATASET_CONCURRENCY,
      async (ds): Promise<DatasetPreview | null> => {
        try {
          const repoId = ds.id;

          let versionAndInfo: Awaited<
            ReturnType<typeof getDatasetVersionAndInfo>
          >;
          try {
            versionAndInfo = await getDatasetVersionAndInfo(repoId);
          } catch (err) {
            console.warn(
              `Skipping incompatible dataset ${repoId}: ${err instanceof Error ? err.message : err}`,
            );
            return null;
          }

          const { version, info } = versionAndInfo;
          const videoEntry = Object.entries(info.features).find(
            ([, value]) => value.dtype === "video",
          );
          if (!videoEntry || !info.video_path) {
            return null;
          }

          const [key] = videoEntry;
          const videoPath = formatStringWithVars(info.video_path, {
            video_key: key,
            episode_chunk: "0".padStart(3, "0"),
            episode_index: "0".padStart(6, "0"),
          });
          return {
            id: repoId,
            videoUrl: buildVersionedUrl(repoId, version, videoPath),
          };
        } catch (err) {
          console.error(
            `Failed to fetch or parse dataset info for ${ds.id}:`,
            err,
          );
          return null;
        }
      },
    )
  ).filter(Boolean) as DatasetPreview[];

  return (
    <ExploreGrid
      datasets={datasetWithVideos}
      currentPage={currentPage}
      totalPages={totalPages}
    />
  );
}
