import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { ServiceProvider } from "./contexts/ServiceContext";
import App from "./App";
import * as useAnimeDataModule from "./hooks/useAnimeData";
import { animeScanner } from "./services/animeScanner/animeScanner";
import {
  AnimeScanHttpError,
  AnimeScanStep,
  AnimeScanner,
} from "./services/animeScanner";
import { type AnimeItem, type AnimeInfo } from "./services/animeScanner/types";

// --- Chrome storage mock (default) ---
const storageMock: Record<string, unknown> = {};

const chromeStorageMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (storageMock[k]) result[k] = storageMock[k];
        });
        return result;
      }),
      set: vi.fn(async (value: Record<string, unknown>) => {
        Object.assign(storageMock, value);
      }),
    },
  },
};

vi.stubGlobal("chrome", chromeStorageMock);

// --- Sample anime data ---
const makeAnime = (overrides: Partial<AnimeItem> = {}): AnimeItem => ({
  link: "https://ani.gamer.com.tw/anime.php?sn=1",
  title: "Test Anime",
  watchCount: 10000,
  episodeCount: 12,
  uploadDate: "2024-01-01T00:00:00.000Z",
  score: 8.5,
  ratingCount: 500,
  description: "A great show.",
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  // Restore chrome mock (some tests override it)
  vi.stubGlobal("chrome", chromeStorageMock);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

// --- Rendering ---
describe("App rendering", () => {
  it("renders the header", async () => {
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("巴哈動畫評分")).toBeDefined();
  });

  it("renders all three tabs", async () => {
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText(/Results/)).toBeDefined();
    expect(screen.getByText(/Favorites/)).toBeDefined();
    expect(screen.getByText(/Trash/)).toBeDefined();
  });

  it("shows empty state when no results", async () => {
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("loads saved data from chrome.storage on mount", async () => {
    const anime = makeAnime();
    storageMock["scannedList"] = [anime];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("falls back to localStorage when chrome is undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    const anime = makeAnime({ title: "LocalStorage Anime" });
    const fav = makeAnime({ title: "Local Fav", link: "http://fav" });
    const trashItem = makeAnime({ title: "Local Trash", link: "http://trash" });
    localStorage.setItem(
      "animeData",
      JSON.stringify({
        scannedList: [anime],
        favoriteList: [fav],
        trashList: [trashItem],
      }),
    );
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("LocalStorage Anime")).toBeDefined();
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Local Fav")).toBeDefined();
    fireEvent.click(screen.getAllByText(/Trash/)[0]);
    expect(screen.getByText("Local Trash")).toBeDefined();
  });

  it("handles empty localStorage gracefully", async () => {
    vi.stubGlobal("chrome", undefined);
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("handles localStorage data with missing favoriteList and trashList keys", async () => {
    vi.stubGlobal("chrome", undefined);
    const anime = makeAnime({ title: "Only Search" });
    // Deliberately omit favoriteList and trashList to trigger the || [] fallback
    localStorage.setItem("animeData", JSON.stringify({ scannedList: [anime] }));
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("Only Search")).toBeDefined();
    // Tabs should show 0 for favorites and trash
    expect(screen.getByText("Favorites")).toBeDefined();
    const tabsContainer = screen.getByTestId("tabs-container");
    const { getAllByText } = within(tabsContainer);
    expect(getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("handles chrome.storage.get error gracefully", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error("storage error")),
          set: vi.fn(),
        },
      },
    });
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });
});

// --- Tab switching ---
describe("Tab switching", () => {
  it("switches to Favorites tab", async () => {
    const fav = makeAnime({
      title: "Fav Anime",
      link: "https://ani.gamer.com.tw/anime.php?sn=2",
    });
    storageMock["favoriteList"] = [fav];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Fav Anime")).toBeDefined();
  });

  it("switches to Trash tab", async () => {
    const trashItem = makeAnime({
      title: "Trash Anime",
      link: "https://ani.gamer.com.tw/anime.php?sn=3",
    });
    storageMock["trashList"] = [trashItem];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Trash Anime")).toBeDefined();
  });

  it("shows empty state on empty Favorites tab", async () => {
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("shows empty state on empty Trash tab", async () => {
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });
});

// --- Actions ---
describe("Card actions", () => {
  it("moves item to Favorites", async () => {
    storageMock["scannedList"] = [makeAnime()];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("moves item to Favorites and saves via localStorage when chrome undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem(
      "animeData",
      JSON.stringify({
        scannedList: [makeAnime()],
        favoriteList: [],
        trashList: [],
      }),
    );
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    const saved = JSON.parse(localStorage.getItem("animeData") || "{}");
    expect(saved.favoriteList).toHaveLength(1);
  });

  it("handles saveData error gracefully without crashing", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ scannedList: [makeAnime()] })),
          set: vi.fn().mockRejectedValue(new Error("quota exceeded")),
        },
      },
    });
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    // Should not throw - just log the error
    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    await act(async () => {});
    expect(screen.getByText("巴哈動畫評分")).toBeDefined();
  });

  it("moves item to Trash from Results", async () => {
    storageMock["scannedList"] = [makeAnime()];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("moves item to Trash from Favorites", async () => {
    const fav = makeAnime({
      title: "Fav Anime",
      link: "https://ani.gamer.com.tw/anime.php?sn=2",
    });
    storageMock["favoriteList"] = [fav];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Favorites/));
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Fav Anime")).toBeDefined();
  });

  it("restores item from Trash", async () => {
    storageMock["trashList"] = [makeAnime()];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByText(/Trash/));
    fireEvent.click(
      screen.getByRole("button", { name: "Restore to Favorites" }),
    );
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });
});

// --- Scan ---
describe("Scan functionality", () => {
  it("shows Scanning... and progress bar while running", async () => {
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);

    let resolvePages: (value: AnimeInfo[]) => void;
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePages = resolve;
        }),
    );

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("progress-container")).toBeDefined(),
    );

    await act(async () => {
      resolvePages([]);
    });
  });

  it("filters results by score threshold after scan and fires progress callback", async () => {
    const highScore = makeAnime({
      title: "High Score",
      score: 5.0,
      episodeCount: 12,
    });
    const lowScore = makeAnime({
      title: "Low Score",
      score: 4.0,
      episodeCount: 12,
      link: "http://other",
    });

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      highScore,
      lowScore,
    ]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        for (const item of options.items) {
          options.onDetailScanned({
            ...item,
            ratingCount: 100,
            description: item.title === "High Score" ? "Good" : "Meh",
            score: item.title === "High Score" ? 5.0 : 4.0,
          } as AnimeItem);
        }
      },
    );

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.getByText("High Score")).toBeDefined();
    expect(screen.queryByText("Low Score")).toBeNull();
  });

  it("skips items with less than 10 episodes", async () => {
    const shortShow = makeAnime({
      title: "Short Show",
      episodeCount: 5,
      score: 9.0,
    });
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      shortShow,
    ]);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("Short Show")).toBeNull();
  });

  it("skips OVA titles", async () => {
    const ova = makeAnime({
      title: "Great Show OVA Special",
      episodeCount: 12,
      score: 9.0,
    });
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([ova]);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("Great Show OVA Special")).toBeNull();
  });

  it("skips items already in trash", async () => {
    const trashItem = makeAnime({
      title: "In Trash",
      episodeCount: 12,
      score: 9.0,
    });
    storageMock["trashList"] = [trashItem];
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      trashItem,
    ]);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("In Trash")).toBeNull();
  });

  it("skips items already in favorites", async () => {
    const favItem = makeAnime({
      title: "In Fav",
      episodeCount: 12,
      score: 9.0,
    });
    storageMock["favoriteList"] = [favItem];
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([favItem]);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("In Fav")).toBeNull();
  });

  it("handles non-numeric episode count by skipping item", async () => {
    const naEp = makeAnime({
      title: "NA Ep",
      episodeCount: NaN,
      score: 9.0,
    });
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([naEp]);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("NA Ep")).toBeNull();
  });

  it("renders error card in fatal error container when scan fails or encounters error", async () => {
    const mockError = new AnimeScanHttpError(
      1,
      AnimeScanStep.SCAN_LIST_PAGE,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 502",
      502,
      undefined,
    );

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(2);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockRejectedValue(mockError);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });

    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());

    expect(screen.getByTestId("fatal-error-container")).toBeDefined();
    expect(
      screen.getByText(/HTTP request failed with status 502/),
    ).toBeDefined();
  });
  it("renders SettingsTab when Settings tab is active", async () => {
    render(
      <ServiceProvider>
        <App />
      </ServiceProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Settings"));
    });

    expect(screen.getByTestId("settings-tab")).toBeInTheDocument();
  });

  it("supports importing backup data through SettingsTab", async () => {
    render(
      <ServiceProvider>
        <App />
      </ServiceProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Settings"));
    });

    const mockFileContent = JSON.stringify({
      scannedList: [
        {
          link: "https://example.com/anime/import-app",
          title: "Imported App Anime",
          watchCount: 500,
          episodeCount: 12,
          uploadDate: "2024-05-01T00:00:00.000Z",
          score: 4.8,
          ratingCount: 100,
          description: "Successfully imported in app",
        },
      ],
    });

    const file = new File([mockFileContent], "backup.json", {
      type: "application/json",
    });

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          this.onload({
            target: {
              result: mockFileContent,
            },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const input = screen.getByTestId("file-import-input");
    fireEvent.change(input, { target: { files: [file] } });

    await act(async () => {
      const searchTab = screen.getByTestId("tab-scanned");
      fireEvent.click(searchTab);
    });

    await waitFor(() => {
      expect(screen.getByText("Imported App Anime")).toBeInTheDocument();
    });
  });

  it("supports sorting items by different columns in search results", async () => {
    const itemA = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=1",
      title: "Apple Anime",
      score: 9.5,
      watchCount: 10000,
      episodeCount: 12,
      uploadDate: "2024-01-01T00:00:00.000Z",
    });
    const itemB = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=2",
      title: "Banana Anime",
      score: 8.0,
      watchCount: 50000,
      episodeCount: 24,
      uploadDate: "2023-01-01T00:00:00.000Z",
    });
    const itemC = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=3",
      title: "Cherry Anime",
      score: 9.0,
      watchCount: 5000,
      episodeCount: 6,
      uploadDate: "2025-01-01T00:00:00.000Z",
    });
    const itemD = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=4",
      title: "Date N/A Anime",
      uploadDate: "Invalid Date",
    });

    const useAnimeDataSpy = vi
      .spyOn(useAnimeDataModule, "useAnimeData")
      .mockReturnValue({
        scannedList: [itemA, itemB, itemC, itemD],
        favoriteList: [],
        trashList: [],
        moveToFavorites: vi.fn(),
        moveToTrash: vi.fn(),
        updateLists: vi.fn(),
        isLoaded: true,
      });

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    // Verify initial rendering order
    let titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles).toContain("Apple Anime");
    expect(titles).toContain("Banana Anime");
    expect(titles).toContain("Cherry Anime");
    expect(titles).toContain("Date N/A Anime");

    // Click score header (defaults to sorting desc)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-score"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Apple Anime"); // 9.5
    expect(titles[1]).toBe("Cherry Anime"); // 9.0
    expect(titles[2]).toBe("Date N/A Anime"); // 8.5

    // Click score header again to toggle asc
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-score"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Banana Anime"); // 8.0
    expect(titles[1]).toBe("Date N/A Anime"); // 8.5
    expect(titles[2]).toBe("Cherry Anime"); // 9.0

    // Click score header a third time to toggle back to desc (covers lines 55)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-score"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Apple Anime"); // 9.5

    // Click uploadDate header (Year) - descending
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-uploadDate"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Cherry Anime"); // 2025
    expect(titles[1]).toBe("Apple Anime"); // 2024
    expect(titles[2]).toBe("Banana Anime"); // 2023

    // Click uploadDate header again (toggle asc)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-uploadDate"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    // Ascending: Date N/A (0), 2023 (Banana), 2024 (Apple), 2025 (Cherry)
    expect(titles[0]).toBe("Date N/A Anime");
    expect(titles[1]).toBe("Banana Anime");
    expect(titles[2]).toBe("Apple Anime");

    // Click title header (desc)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-title"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Date N/A Anime");
    expect(titles[1]).toBe("Cherry Anime");
    expect(titles[2]).toBe("Banana Anime");

    // Click title header again (asc)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-title"));
    });
    titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles[0]).toBe("Apple Anime");
    expect(titles[1]).toBe("Banana Anime");
    expect(titles[2]).toBe("Cherry Anime");

    useAnimeDataSpy.mockRestore();
  });

  it("handles sorting when multiple items have invalid uploadDate (NaN) or mismatched types", async () => {
    const itemX = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=10",
      title: "X Anime",
      uploadDate: "Invalid Date",
    });
    // @ts-expect-error - testing sorting with mismatched type
    itemX.watchCount = "mismatched";
    const itemY = makeAnime({
      link: "https://ani.gamer.com.tw/anime.php?sn=11",
      title: "Y Anime",
      uploadDate: "Invalid Date",
    });

    const useAnimeDataSpy = vi
      .spyOn(useAnimeDataModule, "useAnimeData")
      .mockReturnValue({
        scannedList: [itemX, itemY],
        favoriteList: [],
        trashList: [],
        moveToFavorites: vi.fn(),
        moveToTrash: vi.fn(),
        updateLists: vi.fn(),
        isLoaded: true,
      });

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    // Sort by watchCount to trigger the typeof comparison failure (reaches return 0)
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-watchCount"));
    });

    // Sort by uploadDate descending then ascending to trigger all comparisons
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-uploadDate"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("sort-header-uploadDate"));
    });

    const titles = screen.getAllByRole("link").map((el) => el.textContent);
    expect(titles).toContain("X Anime");
    expect(titles).toContain("Y Anime");

    useAnimeDataSpy.mockRestore();
  });

  it("renders scan stats panel when scan finishes and allows dismissing it", async () => {
    const anime = makeAnime({
      title: "Scan Stats Anime",
      score: 4.9,
      link: "http://stats-anime",
    });
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([anime]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        for (const item of options.items) {
          options.onDetailScanned({
            ...item,
            ratingCount: 100,
            description: "Stats item",
            score: 4.9,
          } as AnimeItem);
        }
      },
    );

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    // Stats container should not be visible before scan
    expect(screen.queryByTestId("scan-stats-container")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });

    // Stats container should be rendered after scan completes
    await waitFor(() =>
      expect(screen.getByTestId("scan-stats-container")).toBeDefined(),
    );
    expect(screen.getByTestId("chip-success")).toBeDefined();
    expect(screen.getByTestId("chip-added")).toBeDefined();

    // Click dismiss button to clear stats
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Dismiss scan results"));
    });

    expect(screen.queryByTestId("scan-stats-container")).toBeNull();
  });

  it("supports dragging the floating status bar to a new position, but ignores dragging when clicking buttons", async () => {
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);

    let resolvePages: (value: AnimeInfo[]) => void;
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePages = resolve;
        }),
    );

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("progress-container")).toBeDefined();
    });

    const floatingBar = screen.getByTestId("floating-status-bar");

    fireEvent.mouseDown(floatingBar, { clientX: 100, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 280 });
    expect(floatingBar.style.getPropertyValue("--drag-x")).toBe("50px");
    expect(floatingBar.style.getPropertyValue("--drag-y")).toBe("80px");
    fireEvent.mouseUp(document);

    await act(async () => {
      resolvePages([]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("scan-stats-container")).toBeDefined();
    });

    const dismissButton = screen.getByRole("button", {
      name: /Dismiss scan results/i,
    });

    fireEvent.mouseDown(dismissButton, { clientX: 150, clientY: 280 });
    fireEvent.mouseMove(document, { clientX: 250, clientY: 380 });

    expect(floatingBar.style.getPropertyValue("--drag-x")).toBe("50px");
    expect(floatingBar.style.getPropertyValue("--drag-y")).toBe("80px");
    fireEvent.mouseUp(document);
  });
});
