import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimeCard } from "./AnimeCard";
import { type AnimeItem } from "../../services/scraper";

const makeAnime = (): AnimeItem => ({
  link: "http://test",
  title: "Test Anime",
  watch_count: 100,
  episode_count: 12,
  upload_date: new Date("2024-01-01"),
  score: 8.5,
  rating_count: 50,
  description: "Desc",
});

describe("AnimeCard", () => {
  it("renders anime info", () => {
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab="search"
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
    item.upload_date = new Date(NaN);
    render(
      <AnimeCard
        item={item}
        activeTab="search"
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
        activeTab="search"
        onMoveToFavorites={favFn}
        onMoveToTrash={trashFn}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("❤ Favorite"));
    expect(favFn).toHaveBeenCalled();
    fireEvent.click(screen.getByText("🗑 Trash"));
    expect(trashFn).toHaveBeenCalled();
    expect(screen.queryByText("↺ Restore")).toBeNull();
  });

  it("shows only trash button in favorites tab", () => {
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab="favorites"
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={vi.fn()}
      />,
    );
    expect(screen.queryByText("❤ Favorite")).toBeNull();
    expect(screen.getByText("🗑 Trash")).toBeDefined();
  });

  it("shows only restore button in trash tab", () => {
    const restoreFn = vi.fn();
    render(
      <AnimeCard
        item={makeAnime()}
        activeTab="trash"
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        onRestoreFromTrash={restoreFn}
      />,
    );
    expect(screen.queryByText("❤ Favorite")).toBeNull();
    expect(screen.queryByText("🗑 Trash")).toBeNull();
    fireEvent.click(screen.getByText("↺ Restore"));
    expect(restoreFn).toHaveBeenCalled();
  });
});
