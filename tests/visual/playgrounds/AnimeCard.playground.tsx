import { AnimeCard } from "../../../src/components/AnimeCard";
import { type AnimeItem } from "../../../src/types/anime";
import { TestContainer } from "./TestContainer";

const mockItem1: AnimeItem = {
  link: "https://ani.gamer.com.tw/animeVideo.php?sn=123",
  title: "Test Anime (Normal)",
  watchCount: 25000,
  episodeCount: 12,
  uploadDate: new Date("2026-01-01T00:00:00Z"),
  score: 8.5,
  ratingCount: 1234,
  description:
    "This is a great test anime with a standard layout and a normal description length.",
};

const mockItem2: AnimeItem = {
  link: "https://ani.gamer.com.tw/animeVideo.php?sn=456",
  title:
    "Test Anime with an Extremely Long Title that Should Wrap Correctly on Multiple Lines in the Card Component Layout",
  watchCount: 120000,
  episodeCount: 24,
  uploadDate: new Date("2025-01-01T00:00:00Z"),
  score: 9.2,
  ratingCount: 5678,
  description:
    "This anime has a very long title and high scores to test how the card behaves under stress.",
};

export default function AnimeCardPlayground({
  params,
}: {
  params: URLSearchParams;
}) {
  const state = params.get("state") || "search";
  const item = state === "long-title" ? mockItem2 : mockItem1;
  const cardState =
    state === "long-title"
      ? "search"
      : (state as "search" | "favorites" | "trash");

  return (
    <TestContainer>
      <div style={{ width: "360px" }}>
        <AnimeCard
          item={item}
          activeTab={cardState}
          onMoveToFavorites={() => {}}
          onMoveToTrash={() => {}}
          onRestoreFromTrash={() => {}}
        />
      </div>
    </TestContainer>
  );
}
