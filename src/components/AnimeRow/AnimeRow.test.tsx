import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimeRow } from "./AnimeRow";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/animeScanner";

const makeAnime = (): AnimeItem => ({
  link: "http://test",
  title: "Test Anime",
  watchCount: 100,
  episodeCount: 12,
  uploadDate: "2024-01-01T00:00:00.000Z",
  score: 4.5,
  ratingCount: 50,
  description: "Desc",
});

const renderInTable = (ui: React.ReactElement) => {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
};

describe("AnimeRow", () => {
  it("renders anime info", () => {
    renderInTable(
      <AnimeRow
        item={makeAnime()}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Anime")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("2024")).toBeDefined();
  });

  it("renders N/A for invalid upload date", () => {
    const item = makeAnime();
    item.uploadDate = "Invalid Date";
    renderInTable(
      <AnimeRow
        item={item}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("N/A")).toBeDefined();
  });

  it("formats views correctly for different ranges", () => {
    const item = makeAnime();
    item.watchCount = 1200000;
    renderInTable(
      <AnimeRow
        item={item}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("1.2M")).toBeDefined();

    const item2 = makeAnime();
    item2.watchCount = 2400;
    renderInTable(
      <AnimeRow
        item={item2}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("2.4K")).toBeDefined();

    const item3 = makeAnime();
    item3.watchCount = 500;
    renderInTable(
      <AnimeRow
        item={item3}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.getByText("500")).toBeDefined();
  });

  it("applies correct score dynamic CSS class based on score value", () => {
    // 5-point scale: Excellent (>= 4.93 for targetScore 4.8)
    const item1 = makeAnime();
    item1.score = 4.95;
    const { container: c1 } = renderInTable(
      <AnimeRow
        item={item1}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(c1.querySelector('[class*="scoreExcellent"]')).toBeDefined();

    // 5-point scale: Good (>= 4.87 for targetScore 4.8)
    const item2 = makeAnime();
    item2.score = 4.9;
    const { container: c2 } = renderInTable(
      <AnimeRow
        item={item2}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(c2.querySelector('[class*="scoreGood"]')).toBeDefined();

    // 5-point scale: Average (< 4.87 for targetScore 4.8)
    const item3 = makeAnime();
    item3.score = 4.82;
    const { container: c3 } = renderInTable(
      <AnimeRow
        item={item3}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(c3.querySelector('[class*="scoreAverage"]')).toBeDefined();

    // 5-point scale: targetScore >= maxScore (range <= 0)
    const item4 = makeAnime();
    item4.score = 5.0;
    const { container: c4 } = renderInTable(
      <AnimeRow
        item={item4}
        activeTab={Tab.Scanned}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
        targetScore={5.0}
      />,
    );
    expect(c4.querySelector('[class*="scoreExcellent"]')).toBeDefined();
  });

  it("shows favorite and trash buttons in search tab", () => {
    const favFn = vi.fn();
    const trashFn = vi.fn();
    renderInTable(
      <AnimeRow
        item={makeAnime()}
        activeTab={Tab.Scanned}
        onMoveToFavorites={favFn}
        onMoveToTrash={trashFn}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    expect(favFn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    expect(trashFn).toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Restore to Favorites" }),
    ).toBeNull();
  });

  it("shows only trash button in favorites tab", () => {
    renderInTable(
      <AnimeRow
        item={makeAnime()}
        activeTab={Tab.Favorites}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Add to Favorites" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Move to Trash" })).toBeDefined();
  });

  it("shows only favorite button in trash tab for restoring", () => {
    const restoreFn = vi.fn();
    renderInTable(
      <AnimeRow
        item={makeAnime()}
        activeTab={Tab.Trash}
        onMoveToFavorites={restoreFn}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Move to Trash" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Restore to Favorites" }),
    );
    expect(restoreFn).toHaveBeenCalled();
  });

  it("throws error for unhandled activeTab state", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderInTable(
        <AnimeRow
          item={makeAnime()}
          activeTab={"InvalidTab" as unknown as Tab}
          onMoveToFavorites={vi.fn()}
          onMoveToTrash={vi.fn()}
        />,
      ),
    ).toThrowError("Unhandled activeTab state: InvalidTab");
    consoleSpy.mockRestore();
  });

  it("renders nothing when activeTab is Settings", () => {
    const { container } = renderInTable(
      <AnimeRow
        item={makeAnime()}
        activeTab={Tab.Settings}
        onMoveToFavorites={vi.fn()}
        onMoveToTrash={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[class*="rowActions"]')?.childNodes.length,
    ).toBe(0);
  });
});
