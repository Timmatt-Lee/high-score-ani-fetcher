import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AnimeTable } from "./AnimeTable";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/animeScanner";

const sampleList: AnimeItem[] = [
  {
    link: "https://example.com/anime/1",
    title: "Frieren: Beyond Journey's End",
    watchCount: 1500000,
    episodeCount: 28,
    uploadDate: new Date("2023-09-29"),
    score: 9.39,
    ratingCount: 120000,
    description: "An elf mage journey.",
  },
];

describe("AnimeTable", () => {
  it("renders headers and list items correctly", () => {
    const handleSort = vi.fn();
    render(
      <AnimeTable
        activeTab={Tab.Search}
        list={sampleList}
        sortBy="score"
        sortOrder="desc"
        onSort={handleSort}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
        targetScore={4.8}
      />,
    );

    expect(screen.getByText("Frieren: Beyond Journey's End")).toBeDefined();
    expect(screen.getByText("★ 9.4")).toBeDefined();

    // Test sort trigger
    const scoreHeader = screen.getByText("Score");
    fireEvent.click(scoreHeader);
    expect(handleSort).toHaveBeenCalledWith("score");
  });
});
