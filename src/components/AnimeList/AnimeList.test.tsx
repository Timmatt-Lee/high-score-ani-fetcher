import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimeList } from "./AnimeList";
import { type AnimeItem } from "../../types/anime";

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watchCount: 100,
  episodeCount: 12,
  uploadDate: new Date("2024-01-01"),
  score: 8.5,
  ratingCount: 50,
  description: "Desc",
});

describe("AnimeList", () => {
  it("renders empty state", () => {
    render(
      <AnimeList
        activeTab="search"
        searchList={[]}
        favorites={[]}
        trash={[]}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("renders searchList when activeTab is search", () => {
    render(
      <AnimeList
        activeTab="search"
        searchList={[makeAnime("Search 1"), makeAnime("Search 2")]}
        favorites={[makeAnime("Fav")]}
        trash={[makeAnime("Trash")]}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("Search 1")).toBeDefined();
    expect(screen.queryByText("Fav")).toBeNull();
  });
});
