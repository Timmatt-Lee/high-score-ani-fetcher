import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimeCard } from "./AnimeCard";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../types/anime";

const makeAnime = (): AnimeItem => ({
  link: "http://test",
  title: "Test Anime",
  watchCount: 100,
  episodeCount: 12,
  uploadDate: new Date("2024-01-01"),
  score: 8.5,
  ratingCount: 50,
  description: "Desc",
});

describe("AnimeCard", () => {
  it("renders anime info", () => {
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab={Tab.Search}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Anime")).toBeDefined();
    expect(screen.getByText("12 Episodes")).toBeDefined();
    expect(screen.getByText("2024")).toBeDefined();
  });

  it("renders N/A for invalid upload date", () => {
    const item = makeAnime();
    item.uploadDate = new Date(NaN);
    render(
      <AnimeCard
        item={item}
        activeTab={Tab.Search}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("N/A")).toBeDefined();
  });

  it("shows favorite and trash buttons in search tab", () => {
    const favFn = vi.fn();
    const trashFn = vi.fn();
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab={Tab.Search}
        onMoveToFavorites={favFn}
        onMoveToTrash={trashFn}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    expect(favFn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Trash" }));
    expect(trashFn).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  it("shows only trash button in favorites tab", () => {
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab={Tab.Favorites}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Favorite" })).toBeNull();
    expect(screen.getByRole("button", { name: "Trash" })).toBeDefined();
  });

  it("shows only restore button in trash tab", () => {
    const restoreFn = vi.fn();
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab={Tab.Trash}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={restoreFn}
      />,
    );
    expect(screen.queryByRole("button", { name: "Favorite" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Trash" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restoreFn).toHaveBeenCalled();
  });

  it("throws error for unhandled activeTab state", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <AnimeCard
          item={makeAnime()}
          activeTab={"InvalidTab" as unknown as Tab}
          onMoveToFavorites={vi.fn()}
          onMoveToTrash={vi.fn()}
          onRestoreFromTrash={vi.fn()}
        />,
      ),
    ).toThrowError("Unhandled activeTab state: InvalidTab");
    consoleSpy.mockRestore();
  });
});
