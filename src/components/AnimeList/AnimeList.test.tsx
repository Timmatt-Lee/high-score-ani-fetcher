import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimeList } from "./AnimeList";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/animeScanner";

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

const defaultArgs = {
  sortBy: null,
  sortOrder: "asc" as const,
  onSort: vi.fn(),
};

describe("AnimeList", () => {
  it("renders empty state", () => {
    render(
      <AnimeList
        {...defaultArgs}
        activeTab={Tab.Search}
        searchList={[]}
        favoriteList={[]}
        trashList={[]}
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
        {...defaultArgs}
        activeTab={Tab.Search}
        searchList={[makeAnime("Search 1"), makeAnime("Search 2")]}
        favoriteList={[makeAnime("Fav")]}
        trashList={[makeAnime("Trash")]}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("Search 1")).toBeDefined();
    expect(screen.queryByText("Fav")).toBeNull();
  });

  it("triggers onSort when headers are clicked", () => {
    const onSortMock = vi.fn();
    render(
      <AnimeList
        {...defaultArgs}
        onSort={onSortMock}
        activeTab={Tab.Search}
        searchList={[makeAnime("Search 1")]}
        favoriteList={[]}
        trashList={[]}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("sort-header-score"));
    expect(onSortMock).toHaveBeenCalledWith("score");

    fireEvent.click(screen.getByTestId("sort-header-title"));
    expect(onSortMock).toHaveBeenCalledWith("title");
  });

  it("throws error for unhandled activeTab state", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <AnimeList
          {...defaultArgs}
          activeTab={"InvalidTab" as unknown as Tab}
          searchList={[]}
          favoriteList={[]}
          trashList={[]}
          onMoveToFavorites={vi.fn()}
          onMoveToTrash={vi.fn()}
          onRestoreFromTrash={vi.fn()}
        />,
      ),
    ).toThrowError("Unhandled activeTab state: InvalidTab");
    consoleSpy.mockRestore();
  });

  it("renders nothing when activeTab is Settings", () => {
    const { container } = render(
      <AnimeList
        {...defaultArgs}
        activeTab={Tab.Settings}
        searchList={[makeAnime("test")]}
        favoriteList={[]}
        trashList={[]}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
