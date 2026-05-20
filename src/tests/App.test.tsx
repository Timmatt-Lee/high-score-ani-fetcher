import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import App from "../App";
import { ScraperService, type AnimeItem } from "../services/scraper";

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
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(storageMock, data);
      }),
    },
  },
};

vi.stubGlobal("chrome", chromeStorageMock);

// --- Sample anime data ---
const makeAnime = (overrides: Partial<AnimeItem> = {}): AnimeItem => ({
  link: "https://ani.gamer.com.tw/anime.php?sn=1",
  title: "Test Anime",
  watch_count: 10000,
  episode_count: "12",
  upload_date: "2024",
  score: 8.5,
  rating_count: 500,
  description: "A great show.",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  // Restore chrome mock (some tests override it)
  vi.stubGlobal("chrome", chromeStorageMock);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// --- Rendering ---
describe("App rendering", () => {
  it("renders the header", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("AniFetcher Pro")).toBeDefined();
  });

  it("renders all three tabs", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText(/Results/)).toBeDefined();
    expect(screen.getByText(/Favorites/)).toBeDefined();
    expect(screen.getByText(/Trash/)).toBeDefined();
  });

  it("shows empty state when no results", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("loads saved data from chrome.storage on mount", async () => {
    const anime = makeAnime();
    storageMock["searchList"] = [anime];
    await act(async () => {
      render(<App />);
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
        searchList: [anime],
        favorites: [fav],
        trash: [trashItem],
      }),
    );
    await act(async () => {
      render(<App />);
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
      render(<App />);
    });
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("handles localStorage data with missing favorites and trash keys", async () => {
    vi.stubGlobal("chrome", undefined);
    const anime = makeAnime({ title: "Only Search" });
    // Deliberately omit favorites and trash to trigger the || [] fallback
    localStorage.setItem("animeData", JSON.stringify({ searchList: [anime] }));
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Only Search")).toBeDefined();
    // Tabs should show 0 for favorites and trash
    expect(screen.getByText(/Favorites \(0\)/)).toBeDefined();
    expect(screen.getByText(/Trash \(0\)/)).toBeDefined();
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
      render(<App />);
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
    storageMock["favorites"] = [fav];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Fav Anime")).toBeDefined();
  });

  it("switches to Trash tab", async () => {
    const trashItem = makeAnime({
      title: "Trash Anime",
      link: "https://ani.gamer.com.tw/anime.php?sn=3",
    });
    storageMock["trash"] = [trashItem];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Trash Anime")).toBeDefined();
  });

  it("shows empty state on empty Favorites tab", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });

  it("shows empty state on empty Trash tab", async () => {
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("No anime found in this list.")).toBeDefined();
  });
});

// --- Actions ---
describe("Card actions", () => {
  it("moves item to Favorites", async () => {
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("❤ Favorite"));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("moves item to Favorites and saves via localStorage when chrome undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem(
      "animeData",
      JSON.stringify({ searchList: [makeAnime()], favorites: [], trash: [] }),
    );
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("❤ Favorite"));
    const saved = JSON.parse(localStorage.getItem("animeData") || "{}");
    expect(saved.favorites).toHaveLength(1);
  });

  it("handles saveData error gracefully without crashing", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ searchList: [makeAnime()] })),
          set: vi.fn().mockRejectedValue(new Error("quota exceeded")),
        },
      },
    });
    await act(async () => {
      render(<App />);
    });
    // Should not throw - just log the error
    fireEvent.click(screen.getByText("❤ Favorite"));
    await act(async () => {});
    expect(screen.getByText("AniFetcher Pro")).toBeDefined();
  });

  it("moves item to Trash from Results", async () => {
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("🗑 Trash"));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("moves item to Trash from Favorites", async () => {
    const fav = makeAnime({
      title: "Fav Anime",
      link: "https://ani.gamer.com.tw/anime.php?sn=2",
    });
    storageMock["favorites"] = [fav];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Favorites/));
    fireEvent.click(screen.getByText("🗑 Trash"));
    fireEvent.click(screen.getByText(/Trash/));
    expect(screen.getByText("Fav Anime")).toBeDefined();
  });

  it("restores item from Trash", async () => {
    storageMock["trash"] = [makeAnime()];
    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText(/Trash/));
    fireEvent.click(screen.getByText("↺ Restore"));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Results/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });
});

// --- Scan ---
describe("Scan functionality", () => {
  it("shows Scanning... and progress bar while running", async () => {
    // Pause scraper so we can capture the intermediate state
    let resolveScrape!: () => void;
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockReturnValue(
      new Promise<AnimeItem[]>((resolve) => {
        resolveScrape = () => resolve([]);
      }),
    );

    await act(async () => {
      render(<App />);
    });
    fireEvent.click(screen.getByText("Scan Bahamut"));

    await waitFor(() => expect(screen.getByText("Scanning...")).toBeDefined());
    act(() => {
      resolveScrape();
    });
  });

  it("filters results by score threshold after scan and fires progress callback", async () => {
    const highScore = makeAnime({
      title: "High Score",
      score: 5.0,
      episode_count: "12",
    });
    const lowScore = makeAnime({
      title: "Low Score",
      score: 4.0,
      episode_count: "12",
      link: "http://other",
    });

    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    const progressCalls: string[] = [];
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockImplementation(
      async (_pages, _concurrency, onProgress) => {
        onProgress(50, "halfway");
        return [highScore, lowScore];
      },
    );
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockImplementation(
      async (link) => {
        if (link === highScore.link)
          return { score: 5.0, rating_count: 100, description: "Good" };
        return { score: 4.0, rating_count: 10, description: "Meh" };
      },
    );

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.getByText("High Score")).toBeDefined();
    expect(screen.queryByText("Low Score")).toBeNull();
    void progressCalls;
  });

  it("skips items with less than 10 episodes", async () => {
    const shortShow = makeAnime({
      title: "Short Show",
      episode_count: "5",
      score: 9.0,
    });
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      shortShow,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("Short Show")).toBeNull();
  });

  it("skips OVA titles", async () => {
    const ova = makeAnime({
      title: "Great Show OVA Special",
      episode_count: "12",
      score: 9.0,
    });
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      ova,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("Great Show OVA Special")).toBeNull();
  });

  it("skips items already in trash", async () => {
    const trashItem = makeAnime({
      title: "In Trash",
      episode_count: "12",
      score: 9.0,
    });
    storageMock["trash"] = [trashItem];
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      trashItem,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("In Trash")).toBeNull();
  });

  it("skips items already in favorites", async () => {
    const favItem = makeAnime({
      title: "In Fav",
      episode_count: "12",
      score: 9.0,
    });
    storageMock["favorites"] = [favItem];
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      favItem,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("In Fav")).toBeNull();
  });

  it("handles non-numeric episode count by skipping item", async () => {
    const naEp = makeAnime({
      title: "NA Ep",
      episode_count: "N/A",
      score: 9.0,
    });
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      naEp,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("NA Ep")).toBeNull();
  });
});
