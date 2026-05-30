import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { ServiceProvider } from "./contexts/ServiceContext";
import App from "./App";
import { scraperService } from "./services/scraper";
import {
  type AnimeItem,
  type ScraperResult,
  type ScanEvent,
} from "./types/anime";
import { ScraperHttpError } from "./errors";
import { Observable, Subject } from "rxjs";

function createMockObservable(
  result: ScraperResult,
  progressEvents: ScanEvent[] = [],
): Observable<ScanEvent> {
  return new Observable<ScanEvent>((subscriber) => {
    for (const event of progressEvents) {
      subscriber.next(event);
    }
    subscriber.next({
      type: "completed",
      result,
    });
    subscriber.complete();
  });
}

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
  uploadDate: new Date("2024-01-01"),
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
    expect(screen.getByText("AniFetcher Pro")).toBeDefined();
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
    storageMock["searchList"] = [anime];
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
        searchList: [anime],
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
    localStorage.setItem("animeData", JSON.stringify({ searchList: [anime] }));
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
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
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Favorites/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("moves item to Favorites and saves via localStorage when chrome undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem(
      "animeData",
      JSON.stringify({
        searchList: [makeAnime()],
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
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    const saved = JSON.parse(localStorage.getItem("animeData") || "{}");
    expect(saved.favoriteList).toHaveLength(1);
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
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    // Should not throw - just log the error
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }));
    await act(async () => {});
    expect(screen.getByText("AniFetcher Pro")).toBeDefined();
  });

  it("moves item to Trash from Results", async () => {
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Trash" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Trash" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.queryByText("Test Anime")).toBeNull();
    fireEvent.click(screen.getByText(/Results/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });
});

// --- Scan ---
describe("Scan functionality", () => {
  it("shows Scanning... and progress bar while running", async () => {
    const subject = new Subject<ScanEvent>();
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockReturnValue(subject);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
    });

    await waitFor(() => expect(screen.getByText("Scanning...")).toBeDefined());
    await act(async () => {
      subject.next({
        type: "completed",
        result: { items: [], httpErrors: [], parseErrors: [] },
      });
      subject.complete();
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

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [highScore, lowScore].filter(filterItem);
        return createMockObservable(
          {
            items: [
              {
                ...highScore,
                score: 5.0,
                ratingCount: 100,
                description: "Good",
              },
              { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
            ].filter((item) => filtered.some((f) => f.link === item.link)),
            httpErrors: [],
            parseErrors: [],
          },
          [
            { type: "page_completed", pageNum: 1, success: true },
            {
              type: "detail_completed",
              title: "Progress title",
              success: true,
            },
          ],
        );
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
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
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [shortShow].filter(filterItem);
        return createMockObservable({
          items: filtered.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
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
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [ova].filter(filterItem);
        return createMockObservable({
          items: filtered.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
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
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [trashItem].filter(filterItem);
        return createMockObservable({
          items: filtered.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
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
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [favItem].filter(filterItem);
        return createMockObservable({
          items: filtered.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
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
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const filtered = [naEp].filter(filterItem);
        return createMockObservable({
          items: filtered.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
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
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
    });
    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.queryByText("NA Ep")).toBeNull();
  });

  it("renders warning alert when scan encounters errors and supports details toggle", async () => {
    const anime = makeAnime({ title: "Partial Success", score: 9.0 });
    const mockError = new ScraperHttpError("", "HTTP 502", 502);

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(2);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [{ ...anime, score: 9.0, ratingCount: 100, description: "x" }],
        httpErrors: [mockError],
        parseErrors: [],
      });
    });

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
    });

    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());

    // Expect warning alert to be rendered
    expect(screen.getByText(/1 parsing\/network errors/)).toBeDefined();
    expect(screen.queryByText(/status 502/)).toBeNull();

    // Toggle to show details
    fireEvent.click(screen.getByText("Show Details"));
    expect(screen.getByText(/URL: unknown/)).toBeDefined();
    expect(screen.getByText(/status 502/)).toBeDefined();

    // Toggle to hide details
    fireEvent.click(screen.getByText("Hide Details"));
    expect(screen.queryByText(/status 502/)).toBeNull();
  });

  it("renders more than 10 errors text when errors count > 10", async () => {
    const anime = makeAnime({ title: "Partial Success", score: 9.0 });
    const errorsList = Array.from(
      { length: 11 },
      (_, i) =>
        new ScraperHttpError(
          `https://ani.gamer.com.tw/animeList.php?page=${i}`,
          `Error ${i}`,
          500,
        ),
    );

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [{ ...anime, score: 9.0, ratingCount: 100, description: "x" }],
        httpErrors: errorsList,
        parseErrors: [],
      });
    });

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
    });

    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());

    // Expect warning alert to be rendered
    expect(screen.getByText(/11 parsing\/network errors/)).toBeDefined();

    // Toggle to show details
    fireEvent.click(screen.getByText("Show Details"));
    expect(screen.getByText(/And 1 more errors.../)).toBeDefined();
  });

  it("renders fatal error screen when scan fails, and clears it on dismiss", async () => {
    const fatalErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/error",
      "Bad Request",
      400,
    );
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(fatalErr);

    await act(async () => {
      render(
        <ServiceProvider>
          <App />
        </ServiceProvider>,
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan 巴哈姆特動漫瘋"));
    });

    // Verify fatal error screen is rendered and progress bar / tabs are NOT rendered
    await waitFor(() =>
      expect(screen.getByTestId("fatal-error-screen")).toBeDefined(),
    );
    expect(screen.queryByTestId("progress-container")).toBeNull();
    expect(screen.queryByTestId("tabs-container")).toBeNull();

    // Verify dismiss button returns UI to normal state
    const dismissBtn = screen.getByTestId("dismiss-error-btn");
    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    expect(screen.queryByTestId("fatal-error-screen")).toBeNull();
    expect(screen.getByTestId("tabs-container")).toBeDefined();
  });
});
